import { schema, systemDb } from '@raqeeb/db';
import { and, asc, eq, gt, inArray, lte, sql } from 'drizzle-orm';
import Redis from 'ioredis';
import { createHmac } from 'node:crypto';

/**
 * Public webhook delivery pipeline (docs/05-api-design/04-webhooks.md), two stages
 * the worker loop calls in turn:
 *
 * 1. fanoutOutboxToWebhooks() — tails outbox_events past a Redis cursor and inserts
 *    one webhook_deliveries row per (event × matching active subscription).
 * 2. deliverDueWebhooks() — claims due deliveries, signs and POSTs them, applies the
 *    backoff schedule, and auto-suspends subscriptions after 20 consecutive failures.
 *
 * Cross-tenant scanning is a documented system operation (systemDb, BYPASSRLS);
 * tenant scoping is preserved by carrying tenant_id on every delivery row.
 */

export const FANOUT_CURSOR_KEY = 'raqeeb:webhooks:fanout_cursor';
export const BACKOFF_SCHEDULE_MS = [
  60_000, // 60s
  300_000, // 5m
  1_800_000, // 30m
  7_200_000, // 2h
  21_600_000, // 6h
  86_400_000, // 24h
] as const;
export const SUSPEND_FAILURE_THRESHOLD = 20;
const DELIVERY_TIMEOUT_MS = 10_000;
const FANOUT_BATCH = 200;
const DELIVERY_BATCH = 50;

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

/** X-Raqeeb-Signature value: HMAC-SHA256 over the exact raw request body. */
export function computeSignature(secret: string, rawBody: string): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

/** Delay before the next attempt after `attempts` failed tries; null = no more retries. */
export function nextBackoff(attempts: number): number | null {
  return BACKOFF_SCHEDULE_MS[attempts - 1] ?? null;
}

// ---- redis cursor -----------------------------------------------------------------

let redis: Redis | undefined;

function getRedis(): Redis {
  redis ??= new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  return redis;
}

export function closeWebhookDelivery(): void {
  redis?.disconnect();
  redis = undefined;
}

// ---- stage 1: outbox → deliveries ---------------------------------------------------

/**
 * Tail outbox_events past the fanout cursor and materialize pending deliveries for
 * every matching active subscription. Returns the number of events scanned (0 = caught
 * up); the cursor only advances after the deliveries for the batch are committed, so a
 * crash between insert and cursor write re-inserts (at-least-once, consumers dedupe).
 */
export async function fanoutOutboxToWebhooks(): Promise<number> {
  const db = systemDb();
  const cursorRaw = await getRedis().get(FANOUT_CURSOR_KEY);
  const cursor = cursorRaw ? Number(cursorRaw) : 0;

  const events = await db
    .select()
    .from(schema.outboxEvents)
    .where(gt(schema.outboxEvents.id, cursor))
    .orderBy(asc(schema.outboxEvents.id))
    .limit(FANOUT_BATCH);
  if (events.length === 0) return 0;

  const tenantIds = [...new Set(events.map((e) => e.tenantId))];
  const hooks = await db
    .select()
    .from(schema.webhooks)
    .where(and(inArray(schema.webhooks.tenantId, tenantIds), eq(schema.webhooks.status, 'active')));
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
  if (deliveries.length > 0) await db.insert(schema.webhookDeliveries).values(deliveries);

  await getRedis().set(FANOUT_CURSOR_KEY, String(events.at(-1)!.id));
  return events.length;
}

// ---- stage 2: deliveries → HTTP -----------------------------------------------------

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
 * Claim due deliveries (pending/failed with next_retry_at <= now), POST each with the
 * HMAC signature headers, and record the outcome. Returns the number claimed.
 */
export async function deliverDueWebhooks(): Promise<number> {
  const db = systemDb();
  const due = await db
    .select({
      delivery: schema.webhookDeliveries,
      webhook: schema.webhooks,
      eventEntityType: schema.outboxEvents.entityType,
      eventEntityId: schema.outboxEvents.entityId,
      eventCreatedAt: schema.outboxEvents.createdAt,
    })
    .from(schema.webhookDeliveries)
    .innerJoin(schema.webhooks, eq(schema.webhookDeliveries.webhookId, schema.webhooks.id))
    .leftJoin(schema.outboxEvents, eq(schema.webhookDeliveries.outboxEventId, schema.outboxEvents.id))
    .where(
      and(
        inArray(schema.webhookDeliveries.status, ['pending', 'failed']),
        lte(schema.webhookDeliveries.nextRetryAt, new Date()),
      ),
    )
    .orderBy(asc(schema.webhookDeliveries.nextRetryAt))
    .limit(DELIVERY_BATCH);

  const suspendedInRun = new Set<string>();
  for (const row of due) {
    const { delivery, webhook } = row;

    // A suspension (now or earlier in this batch) parks remaining deliveries for good;
    // reactivate resumes from NEW events only.
    if (webhook.status !== 'active' || suspendedInRun.has(webhook.id)) {
      await db
        .update(schema.webhookDeliveries)
        .set({ status: 'failed', nextRetryAt: null })
        .where(eq(schema.webhookDeliveries.id, delivery.id));
      continue;
    }

    const rawBody = JSON.stringify({
      id: delivery.outboxEventId,
      type: delivery.eventType,
      entityType: row.eventEntityType ?? null,
      entityId: row.eventEntityId ?? null,
      payload: delivery.payload,
      createdAt: (row.eventCreatedAt ?? delivery.createdAt).toISOString(),
    });
    const responseCode = await postDelivery(
      webhook.url,
      delivery.id,
      delivery.eventType,
      computeSignature(webhook.secret, rawBody),
      rawBody,
    );

    const attempts = delivery.attempts + 1;
    const attemptAt = new Date();

    if (responseCode !== null && responseCode >= 200 && responseCode < 300) {
      await db
        .update(schema.webhookDeliveries)
        .set({ status: 'success', attempts, responseCode, lastAttemptAt: attemptAt, nextRetryAt: null })
        .where(eq(schema.webhookDeliveries.id, delivery.id));
      await db
        .update(schema.webhooks)
        .set({ lastSuccessAt: attemptAt, failureCount: 0 })
        .where(eq(schema.webhooks.id, webhook.id));
      continue;
    }

    const [hook] = await db
      .update(schema.webhooks)
      .set({ failureCount: sql`${schema.webhooks.failureCount} + 1` })
      .where(eq(schema.webhooks.id, webhook.id))
      .returning({ failureCount: schema.webhooks.failureCount });
    const suspend = (hook?.failureCount ?? 0) >= SUSPEND_FAILURE_THRESHOLD;
    if (suspend) {
      suspendedInRun.add(webhook.id);
      await db
        .update(schema.webhooks)
        .set({ status: 'suspended' })
        .where(eq(schema.webhooks.id, webhook.id));
    }

    const delayMs = nextBackoff(attempts);
    await db
      .update(schema.webhookDeliveries)
      .set({
        status: 'failed',
        attempts,
        responseCode,
        lastAttemptAt: attemptAt,
        // null next_retry_at = terminal failure: never claimed again
        nextRetryAt: suspend || delayMs === null ? null : new Date(attemptAt.getTime() + delayMs),
      })
      .where(eq(schema.webhookDeliveries.id, delivery.id));
  }
  return due.length;
}
