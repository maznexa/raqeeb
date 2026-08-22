import { schema, systemDb } from '@raqeeb/db';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { createHmac } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Public webhook delivery pipeline (docs/05-api-design/04-webhooks.md), two stages
 * the worker loop calls in turn:
 *
 * 1. fanoutOutboxToWebhooks() — claims un-fanned outbox_events (durable per-row
 *    marker, FOR UPDATE SKIP LOCKED) and inserts one delivery per matching active
 *    subscription, marking the events fanned-out in the SAME transaction. There is
 *    no Redis cursor: progress survives a Redis flush and never skips events
 *    committed out of id order.
 * 2. deliverDueWebhooks() — claims due deliveries (SKIP LOCKED → in_flight), signs
 *    and POSTs them with SSRF protection and bounded per-webhook-ordered concurrency,
 *    applies the backoff schedule, and suspends a subscription only after a sustained
 *    failure window.
 *
 * Cross-tenant scanning is a documented system operation (systemDb, BYPASSRLS);
 * tenant scoping is preserved by carrying tenant_id on every delivery row.
 */

export const BACKOFF_SCHEDULE_MS = [
  60_000, // 60s
  300_000, // 5m
  1_800_000, // 30m
  7_200_000, // 2h
  21_600_000, // 6h
  86_400_000, // 24h
] as const;
export const SUSPEND_FAILURE_THRESHOLD = 20;
/** A subscription is suspended only after failing for at least this long — a short
 *  burst against a briefly-down endpoint must not instantly disable it. */
export const SUSPEND_WINDOW_MS = 4 * 60 * 60 * 1000;

const DELIVERY_TIMEOUT_MS = 10_000;
const FANOUT_BATCH = 500;
const INSERT_CHUNK = 500; // rows/insert — far under Postgres's 65,535 bind-param cap
const DELIVERY_BATCH = 50;
const DELIVERY_CONCURRENCY = 10;

// ---- pure helpers (unit-tested in apps/api/test/webhooks.test.ts) ----------------

/** One filter against one event type: exact ("task.created"), prefix ("task.*"), or "*". */
export function matchEventFilter(filter: string, eventType: string): boolean {
  if (filter === '*') return true;
  if (filter.endsWith('.*')) return eventType.startsWith(filter.slice(0, -1));
  return filter === eventType;
}

export function matchesAnyFilter(filters: string[], eventType: string): boolean {
  return filters.some((f) => matchEventFilter(f, eventType));
}

/**
 * X-Raqeeb-Signature value, Stripe-style: `t=<unix>,v1=<hmac>` where the HMAC-SHA256
 * is computed over `"<t>.<rawBody>"`. The signed timestamp lets receivers reject
 * replays outside a tolerance window (documented: 300s).
 */
export function computeSignature(secret: string, rawBody: string, timestampSec: number): string {
  const v1 = createHmac('sha256', secret).update(`${timestampSec}.${rawBody}`).digest('hex');
  return `t=${timestampSec},v1=${v1}`;
}

/** Delay before the next attempt after `attempts` failed tries; null = no more retries. */
export function nextBackoff(attempts: number): number | null {
  return BACKOFF_SCHEDULE_MS[attempts - 1] ?? null;
}

// ---- SSRF protection --------------------------------------------------------------

/** True if an already-resolved IP literal falls in a loopback/private/link-local range. */
export function isPrivateAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPrivateV4(ip);
  if (family === 6) return isPrivateV6(ip.toLowerCase());
  return true; // unparseable → treat as unsafe
}

function isPrivateV4(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = p as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true; // this-net, private, loopback
  if (a === 169 && b === 254) return true; // link-local (cloud metadata 169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateV6(ip: string): boolean {
  if (ip === '::1' || ip === '::') return true; // loopback / unspecified
  if (ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb'))
    return true; // link-local fe80::/10
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // unique-local fc00::/7
  if (ip.startsWith('ff')) return true; // multicast
  const mapped = ip.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/); // IPv4-mapped
  if (mapped) return isPrivateV4(mapped[1]!);
  return false;
}

/**
 * A webhook target is deliverable only if it is https and every resolved address is
 * public. Resolution happens at DELIVERY time (not registration) to defeat DNS
 * rebinding. WEBHOOK_ALLOW_PRIVATE=1 opts out for local development/tests.
 */
export async function isSafeDeliveryUrl(
  rawUrl: string,
  opts: { allowPrivate?: boolean } = {},
): Promise<boolean> {
  const allowPrivate = opts.allowPrivate ?? process.env.WEBHOOK_ALLOW_PRIVATE === '1';
  if (allowPrivate) return true;
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  try {
    const addrs = await lookup(u.hostname, { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateAddress(a.address));
  } catch {
    return false;
  }
}

// ---- shutdown hook (no external client held any more) -------------------------------

export function closeWebhookDelivery(): void {
  // The Redis cursor is gone; nothing to release. Kept so the worker's stop()
  // handler contract is stable.
}

// ---- stage 1: outbox → deliveries ---------------------------------------------------

export async function fanoutOutboxToWebhooks(): Promise<number> {
  const db = systemDb();
  return db.transaction(async (tx) => {
    const events = await tx
      .select()
      .from(schema.outboxEvents)
      .where(isNull(schema.outboxEvents.fannedOutAt))
      .orderBy(asc(schema.outboxEvents.id))
      .limit(FANOUT_BATCH)
      .for('update', { skipLocked: true });
    if (events.length === 0) return 0;

    const tenantIds = [...new Set(events.map((e) => e.tenantId))];
    const hooks = await tx
      .select()
      .from(schema.webhooks)
      .where(
        and(inArray(schema.webhooks.tenantId, tenantIds), eq(schema.webhooks.status, 'active')),
      );
    const hooksByTenant = new Map<string, typeof hooks>();
    for (const hook of hooks) {
      const list = hooksByTenant.get(hook.tenantId) ?? [];
      list.push(hook);
      hooksByTenant.set(hook.tenantId, list);
    }

    const now = new Date();
    const deliveries: (typeof schema.webhookDeliveries.$inferInsert)[] = [];
    for (const event of events) {
      for (const hook of hooksByTenant.get(event.tenantId) ?? []) {
        if (!matchesAnyFilter(hook.events as string[], event.eventType)) continue;
        deliveries.push({
          tenantId: event.tenantId,
          webhookId: hook.id,
          outboxEventId: event.id,
          eventType: event.eventType,
          payload: event.payload,
          status: 'pending',
          nextRetryAt: now,
        });
      }
    }
    // Chunked insert keeps a large fan-out under the bind-parameter cap.
    for (let i = 0; i < deliveries.length; i += INSERT_CHUNK) {
      await tx.insert(schema.webhookDeliveries).values(deliveries.slice(i, i + INSERT_CHUNK));
    }

    // Mark fanned-out in the SAME transaction as the delivery inserts: either both
    // commit or neither does, so no event is skipped and none double-fans.
    await tx
      .update(schema.outboxEvents)
      .set({ fannedOutAt: now })
      .where(
        inArray(
          schema.outboxEvents.id,
          events.map((e) => e.id),
        ),
      );
    return events.length;
  });
}

// ---- stage 2: deliveries → HTTP -----------------------------------------------------

interface ClaimedDelivery {
  id: string;
  webhook_id: string;
  outbox_event_id: number;
  event_type: string;
  payload: unknown;
  attempts: number;
}

async function postDelivery(
  url: string,
  deliveryId: string,
  eventType: string,
  signature: string,
  rawBody: string,
): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Raqeeb-Webhooks/1',
        'x-raqeeb-event': eventType,
        'x-raqeeb-delivery': deliveryId,
        'x-raqeeb-signature': signature,
      },
      body: rawBody,
      redirect: 'manual', // redirects are not followed (webhooks doc)
      signal: controller.signal,
    });
    return res.status;
  } catch {
    return null; // network error or 10s timeout — retried like a 5xx
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Claim due deliveries for ACTIVE webhooks only (SKIP LOCKED so multiple worker
 * replicas never double-claim; in_flight rows older than 5 min are reclaimed after a
 * crash), then POST each with bounded concurrency. Deliveries for suspended webhooks
 * are simply not claimed — reactivation makes them due again. Returns the number claimed.
 */
export async function deliverDueWebhooks(): Promise<number> {
  const db = systemDb();
  const claimedResult = await db.execute(sql`
    UPDATE webhook_deliveries d
    SET status = 'in_flight', last_attempt_at = now()
    WHERE d.id IN (
      SELECT d2.id
      FROM webhook_deliveries d2
      JOIN webhooks w ON w.id = d2.webhook_id AND w.status = 'active'
      WHERE (
        (d2.status IN ('pending', 'failed') AND d2.next_retry_at <= now())
        OR (d2.status = 'in_flight' AND d2.last_attempt_at < now() - interval '5 minutes')
      )
      ORDER BY d2.next_retry_at NULLS FIRST
      LIMIT ${DELIVERY_BATCH}
      FOR UPDATE OF d2 SKIP LOCKED
    )
    RETURNING d.id, d.webhook_id, d.outbox_event_id, d.event_type, d.payload, d.attempts
  `);
  // node-postgres returns bigint columns as strings — normalize so the
  // eventById lookups (number keys) and arithmetic behave.
  const claimed = (claimedResult.rows as unknown as ClaimedDelivery[]).map((r) => ({
    ...r,
    outbox_event_id: Number(r.outbox_event_id),
    attempts: Number(r.attempts),
  }));
  if (claimed.length === 0) return 0;

  const webhookIds = [...new Set(claimed.map((d) => d.webhook_id))];
  const eventIds = [...new Set(claimed.map((d) => d.outbox_event_id).filter((id) => id > 0))];
  const hooks = await db
    .select()
    .from(schema.webhooks)
    .where(inArray(schema.webhooks.id, webhookIds));
  const hookById = new Map(hooks.map((h) => [h.id, h]));
  const events =
    eventIds.length > 0
      ? await db
          .select()
          .from(schema.outboxEvents)
          .where(inArray(schema.outboxEvents.id, eventIds))
      : [];
  const eventById = new Map(events.map((e) => [e.id, e]));

  // Group by webhook so a subscription's deliveries stay ordered; run groups through
  // a bounded pool so one dead endpoint can't monopolize the batch.
  const groups = new Map<string, ClaimedDelivery[]>();
  for (const d of claimed) {
    const list = groups.get(d.webhook_id) ?? [];
    list.push(d);
    groups.set(d.webhook_id, list);
  }
  const groupTasks = [...groups.values()].map((rows) => async () => {
    for (const row of rows) await processDelivery(db, row, hookById.get(row.webhook_id), eventById);
  });
  await runPool(groupTasks, DELIVERY_CONCURRENCY);
  return claimed.length;
}

async function processDelivery(
  db: ReturnType<typeof systemDb>,
  row: ClaimedDelivery,
  hook: typeof schema.webhooks.$inferSelect | undefined,
  eventById: Map<number, typeof schema.outboxEvents.$inferSelect>,
): Promise<void> {
  const attempts = row.attempts + 1;
  const attemptAt = new Date();
  if (!hook) {
    await db
      .update(schema.webhookDeliveries)
      .set({ status: 'failed', attempts, lastAttemptAt: attemptAt, nextRetryAt: null })
      .where(eq(schema.webhookDeliveries.id, row.id));
    return;
  }

  // SSRF guard: an unsafe target never becomes safe → terminal failure, no HTTP call.
  if (!(await isSafeDeliveryUrl(hook.url))) {
    await db
      .update(schema.webhookDeliveries)
      .set({ status: 'failed', attempts, responseCode: null, lastAttemptAt: attemptAt, nextRetryAt: null })
      .where(eq(schema.webhookDeliveries.id, row.id));
    return;
  }

  const event = row.outbox_event_id > 0 ? eventById.get(row.outbox_event_id) : undefined;
  const rawBody = JSON.stringify({
    id: row.outbox_event_id,
    type: row.event_type,
    entityType: event?.entityType ?? null,
    entityId: event?.entityId ?? null,
    payload: row.payload,
    createdAt: (event?.createdAt ?? attemptAt).toISOString(),
  });
  const timestampSec = Math.floor(Date.now() / 1000);
  const responseCode = await postDelivery(
    hook.url,
    row.id,
    row.event_type,
    computeSignature(hook.secret, rawBody, timestampSec),
    rawBody,
  );

  if (responseCode !== null && responseCode >= 200 && responseCode < 300) {
    await db
      .update(schema.webhookDeliveries)
      .set({ status: 'success', attempts, responseCode, lastAttemptAt: attemptAt, nextRetryAt: null })
      .where(eq(schema.webhookDeliveries.id, row.id));
    await db
      .update(schema.webhooks)
      .set({ lastSuccessAt: attemptAt, failureCount: 0, firstFailureAt: null })
      .where(eq(schema.webhooks.id, hook.id));
    return;
  }

  // Failure: bump the streak (stamping firstFailureAt on the first miss), and suspend
  // only once BOTH the count threshold and the sustained window are crossed.
  const [updated] = await db
    .update(schema.webhooks)
    .set({
      failureCount: sql`${schema.webhooks.failureCount} + 1`,
      firstFailureAt: sql`COALESCE(${schema.webhooks.firstFailureAt}, now())`,
    })
    .where(eq(schema.webhooks.id, hook.id))
    .returning({
      failureCount: schema.webhooks.failureCount,
      firstFailureAt: schema.webhooks.firstFailureAt,
    });
  const streakStart = updated?.firstFailureAt?.getTime() ?? attemptAt.getTime();
  const suspend =
    (updated?.failureCount ?? 0) >= SUSPEND_FAILURE_THRESHOLD &&
    attemptAt.getTime() - streakStart >= SUSPEND_WINDOW_MS;
  if (suspend) {
    await db.update(schema.webhooks).set({ status: 'suspended' }).where(eq(schema.webhooks.id, hook.id));
  }

  const delayMs = nextBackoff(attempts);
  await db
    .update(schema.webhookDeliveries)
    .set({
      status: 'failed',
      attempts,
      responseCode,
      lastAttemptAt: attemptAt,
      // Keep a retry time even when suspended: reactivation makes parked deliveries
      // due again instead of losing them. Only exhausting the schedule is terminal.
      nextRetryAt: delayMs === null ? null : new Date(attemptAt.getTime() + delayMs),
    })
    .where(eq(schema.webhookDeliveries.id, row.id));
}

/** Run async task thunks with at most `concurrency` in flight. */
async function runPool(tasks: Array<() => Promise<void>>, concurrency: number): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (cursor < tasks.length) {
      const task = tasks[cursor++]!;
      await task();
    }
  });
  await Promise.all(workers);
}
