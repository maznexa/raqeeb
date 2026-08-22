import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { closePools, schema, systemDb, withTenant } from '@raqeeb/db';
import { eq } from 'drizzle-orm';
import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BACKOFF_SCHEDULE_MS,
  closeWebhookDelivery,
  computeSignature,
  deliverDueWebhooks,
  fanoutOutboxToWebhooks,
  matchesAnyFilter,
  matchEventFilter,
  nextBackoff,
  SUSPEND_FAILURE_THRESHOLD,
} from '../../worker/src/webhook-delivery';
import type { TenantContext } from '../src/auth/decorators';
import { AuditService } from '../src/platform/audit.service';
import { WebhooksService } from '../src/platform/webhooks.service';

/**
 * Pure delivery mechanics (filters, signature, backoff) plus WebhooksService and the
 * worker fan-out/delivery loop against REAL Postgres + Redis and a local HTTP sink.
 * Requires a migrated database: docker compose up -d && pnpm db:migrate.
 */

process.env.DATABASE_URL ??= 'postgres://raqeeb_app:raqeeb_app@localhost:5432/raqeeb';
process.env.DATABASE_URL_SYSTEM ??= 'postgres://raqeeb_system:raqeeb_system@localhost:5432/raqeeb';
process.env.REDIS_URL ??= 'redis://localhost:6379';

// ---- pure functions --------------------------------------------------------------

describe('matchEventFilter', () => {
  it.each<[filter: string, eventType: string, expected: boolean]>([
    ['task.created', 'task.created', true],
    ['task.created', 'task.updated', false],
    ['task.created', 'task.created_x', false],
    ['task.*', 'task.created', true],
    ['task.*', 'task.status_changed', true],
    ['task.*', 'project.created', false],
    ['task.*', 'task', false],
    ['comment.*', 'task.created', false],
    ['*', 'task.created', true],
    ['*', 'anything.at_all', true],
  ])('filter %s vs %s -> %s', (filter, eventType, expected) => {
    expect(matchEventFilter(filter, eventType)).toBe(expected);
  });

  it('matchesAnyFilter is an OR over the subscription list', () => {
    expect(matchesAnyFilter(['project.*', 'task.created'], 'task.created')).toBe(true);
    expect(matchesAnyFilter(['project.*', 'comment.created'], 'task.created')).toBe(false);
    expect(matchesAnyFilter([], 'task.created')).toBe(false);
    expect(matchesAnyFilter(['*'], 'task.created')).toBe(true);
  });
});

describe('computeSignature', () => {
  const secret = 'whsec_raq_test-secret';
  const body = '{"id":1,"type":"task.created"}';

  it('is deterministic and hex-encoded with the sha256= prefix', () => {
    const sig = computeSignature(secret, body);
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(computeSignature(secret, body)).toBe(sig);
  });

  it('is verifiable by a receiver with plain node crypto over the raw body', () => {
    const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
    expect(computeSignature(secret, body)).toBe(expected);
  });

  it('changes with either the secret or the body', () => {
    const sig = computeSignature(secret, body);
    expect(computeSignature('whsec_raq_other', body)).not.toBe(sig);
    expect(computeSignature(secret, body + ' ')).not.toBe(sig);
  });
});

describe('nextBackoff', () => {
  it('walks the schedule 60s -> 5m -> 30m -> 2h -> 6h -> 24h, then gives up', () => {
    const delays = [1, 2, 3, 4, 5, 6, 7].map((attempts) => nextBackoff(attempts));
    expect(delays).toEqual([60_000, 300_000, 1_800_000, 7_200_000, 21_600_000, 86_400_000, null]);
  });

  it('schedule is strictly increasing (exponential-ish)', () => {
    for (let i = 1; i < BACKOFF_SCHEDULE_MS.length; i++) {
      expect(BACKOFF_SCHEDULE_MS[i]!).toBeGreaterThan(BACKOFF_SCHEDULE_MS[i - 1]!);
    }
  });
});

// ---- service + worker pipeline against real infrastructure -------------------------

const STAMP = Date.now().toString(36);

interface Fixture {
  tenantId: string;
  accountIds: string[];
  owner: TenantContext;
  member: TenantContext;
}

async function provisionTenant(slug: string): Promise<Fixture> {
  const db = systemDb();
  const [tenant] = await db
    .insert(schema.tenants)
    .values({ name: slug, slug, planId: 'free' })
    .returning();

  const members: TenantContext[] = [];
  const accountIds: string[] = [];
  for (const [name, role] of [
    ['Owner', 'owner'],
    ['Member', 'member'],
  ] as const) {
    const [account] = await db
      .insert(schema.accounts)
      .values({ email: `${name.toLowerCase()}-${slug}@test.local`, displayName: name })
      .returning();
    const [membership] = await db
      .insert(schema.memberships)
      .values({ tenantId: tenant!.id, accountId: account!.id, displayName: name, role })
      .returning();
    accountIds.push(account!.id);
    members.push({ tenantId: tenant!.id, membershipId: membership!.id, role });
  }
  return { tenantId: tenant!.id, accountIds, owner: members[0]!, member: members[1]! };
}

const service = new WebhooksService(new AuditService());

interface CapturedRequest {
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

let a: Fixture;
let b: Fixture;
let server: Server;
let baseUrl: string;
const received: CapturedRequest[] = [];

beforeAll(async () => {
  await systemDb()
    .insert(schema.plans)
    .values({ id: 'free', name: 'Free', monthlyPricePerSeat: '0' })
    .onConflictDoNothing();
  a = await provisionTenant(`wh-a-${STAMP}`);
  b = await provisionTenant(`wh-b-${STAMP}`);

  // Local HTTP sink: /ok answers 200, /fail answers 500.
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      received.push({ path: req.url ?? '', headers: req.headers, body });
      res.statusCode = req.url === '/ok' ? 200 : 500;
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const db = systemDb();
  for (const f of [a, b]) {
    await db.delete(schema.tenants).where(eq(schema.tenants.id, f.tenantId)); // cascades webhooks + deliveries
    for (const id of f.accountIds) await db.delete(schema.accounts).where(eq(schema.accounts.id, id));
  }
  closeWebhookDelivery();
  await closePools();
});

async function fanoutUntilCaughtUp(): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if ((await fanoutOutboxToWebhooks()) === 0) return;
  }
  throw new Error('fanout did not catch up with the outbox');
}

describe('WebhooksService', () => {
  it('create returns the whsec_raq_ secret exactly once; list exposes health, never the secret', async () => {
    const created = await service.create(a.owner, {
      url: `${baseUrl}/ok`,
      events: ['task.created'],
    });
    expect(created.secret).toMatch(/^whsec_raq_[A-Za-z0-9_-]{43}$/);
    expect(created.status).toBe('active');
    expect(created.failureCount).toBe(0);
    expect(created.lastSuccessAt).toBeNull();

    const listed = await service.list(a.owner);
    const row = listed.find((w) => w.id === created.id);
    expect(row).toBeDefined();
    expect(row).not.toHaveProperty('secret');
    expect(row!.events).toEqual(['task.created']);

    await service.remove(a.owner, created.id);
  });

  it('create and delete are owner/admin only', async () => {
    await expect(
      service.create(a.member, { url: `${baseUrl}/ok`, events: ['*'] }),
    ).rejects.toThrow(ForbiddenException);

    const created = await service.create(a.owner, { url: `${baseUrl}/ok`, events: ['*'] });
    await expect(service.remove(a.member, created.id)).rejects.toThrow(ForbiddenException);
    await expect(service.remove(a.owner, created.id)).resolves.toEqual({ deleted: true });
    await expect(service.remove(a.owner, created.id)).rejects.toThrow(NotFoundException);
  });

  it('treats another tenant\'s webhook as not found (RLS-invisible)', async () => {
    const created = await service.create(a.owner, { url: `${baseUrl}/ok`, events: ['*'] });
    await expect(service.remove(b.owner, created.id)).rejects.toThrow(NotFoundException);
    await expect(service.reactivate(b.owner, created.id)).rejects.toThrow(NotFoundException);
    await service.remove(a.owner, created.id);
  });

  it('reactivate resets failureCount and status', async () => {
    const created = await service.create(a.owner, { url: `${baseUrl}/ok`, events: ['*'] });
    await systemDb()
      .update(schema.webhooks)
      .set({ status: 'suspended', failureCount: SUSPEND_FAILURE_THRESHOLD })
      .where(eq(schema.webhooks.id, created.id));

    const revived = await service.reactivate(a.owner, created.id);
    expect(revived.status).toBe('active');
    expect(revived.failureCount).toBe(0);
    await service.remove(a.owner, created.id);
  });
});

describe('webhook delivery pipeline', () => {
  it('fans out one outbox event to matching subscriptions, signs and POSTs, applies backoff on failure', async () => {
    const okHook = await service.create(a.owner, { url: `${baseUrl}/ok`, events: ['task.*'] });
    const failHook = await service.create(a.owner, { url: `${baseUrl}/fail`, events: ['*'] });
    const offTopicHook = await service.create(a.owner, { url: `${baseUrl}/ok`, events: ['comment.*'] });

    const entityId = crypto.randomUUID();
    await withTenant(a.tenantId, (db) =>
      db.insert(schema.outboxEvents).values({
        tenantId: a.tenantId,
        eventType: 'task.created',
        entityType: 'task',
        entityId,
        payload: { title: 'Webhook me' },
      }),
    );

    await fanoutUntilCaughtUp();

    const deliveries = await systemDb()
      .select()
      .from(schema.webhookDeliveries)
      .where(eq(schema.webhookDeliveries.tenantId, a.tenantId));
    const okDelivery = deliveries.find((d) => d.webhookId === okHook.id);
    const failDelivery = deliveries.find((d) => d.webhookId === failHook.id);
    expect(okDelivery?.status).toBe('pending');
    expect(failDelivery?.status).toBe('pending');
    expect(deliveries.some((d) => d.webhookId === offTopicHook.id)).toBe(false);

    const before = Date.now();
    await deliverDueWebhooks();

    // The 2xx endpoint got a signed, verifiable request.
    const hit = received.find((r) => r.headers['x-raqeeb-delivery'] === okDelivery!.id);
    expect(hit).toBeDefined();
    expect(hit!.path).toBe('/ok');
    expect(hit!.headers['x-raqeeb-event']).toBe('task.created');
    expect(hit!.headers['x-raqeeb-signature']).toBe(computeSignature(okHook.secret, hit!.body));
    const envelope = JSON.parse(hit!.body);
    expect(envelope.type).toBe('task.created');
    expect(envelope.entityType).toBe('task');
    expect(envelope.entityId).toBe(entityId);
    expect(envelope.payload).toEqual({ title: 'Webhook me' });

    const [okAfter] = await systemDb()
      .select()
      .from(schema.webhookDeliveries)
      .where(eq(schema.webhookDeliveries.id, okDelivery!.id));
    expect(okAfter!.status).toBe('success');
    expect(okAfter!.responseCode).toBe(200);
    expect(okAfter!.attempts).toBe(1);
    const [okHookAfter] = await systemDb()
      .select()
      .from(schema.webhooks)
      .where(eq(schema.webhooks.id, okHook.id));
    expect(okHookAfter!.failureCount).toBe(0);
    expect(okHookAfter!.lastSuccessAt).not.toBeNull();

    // The 500 endpoint moved onto the first backoff step (60s) and bumped failureCount.
    const [failAfter] = await systemDb()
      .select()
      .from(schema.webhookDeliveries)
      .where(eq(schema.webhookDeliveries.id, failDelivery!.id));
    expect(failAfter!.status).toBe('failed');
    expect(failAfter!.responseCode).toBe(500);
    expect(failAfter!.attempts).toBe(1);
    const retryDelta = failAfter!.nextRetryAt!.getTime() - before;
    expect(retryDelta).toBeGreaterThan(50_000);
    expect(retryDelta).toBeLessThan(90_000);
    const [failHookAfter] = await systemDb()
      .select()
      .from(schema.webhooks)
      .where(eq(schema.webhooks.id, failHook.id));
    expect(failHookAfter!.failureCount).toBe(1);
    expect(failHookAfter!.status).toBe('active');
  }, 30_000);

  it('suspends the webhook at the failure threshold and terminally fails the delivery', async () => {
    const doomed = await service.create(a.owner, { url: `${baseUrl}/fail`, events: ['*'] });
    await systemDb()
      .update(schema.webhooks)
      .set({ failureCount: SUSPEND_FAILURE_THRESHOLD - 1 })
      .where(eq(schema.webhooks.id, doomed.id));
    const [delivery] = await systemDb()
      .insert(schema.webhookDeliveries)
      .values({
        tenantId: a.tenantId,
        webhookId: doomed.id,
        outboxEventId: 0,
        eventType: 'task.created',
        payload: {},
        status: 'pending',
        nextRetryAt: new Date(),
      })
      .returning();

    await deliverDueWebhooks();

    const [hookAfter] = await systemDb()
      .select()
      .from(schema.webhooks)
      .where(eq(schema.webhooks.id, doomed.id));
    expect(hookAfter!.status).toBe('suspended');
    expect(hookAfter!.failureCount).toBe(SUSPEND_FAILURE_THRESHOLD);

    const [deliveryAfter] = await systemDb()
      .select()
      .from(schema.webhookDeliveries)
      .where(eq(schema.webhookDeliveries.id, delivery!.id));
    expect(deliveryAfter!.status).toBe('failed');
    expect(deliveryAfter!.nextRetryAt).toBeNull();

    // Once suspended, further due deliveries are parked without an HTTP attempt.
    const [parked] = await systemDb()
      .insert(schema.webhookDeliveries)
      .values({
        tenantId: a.tenantId,
        webhookId: doomed.id,
        outboxEventId: 0,
        eventType: 'task.updated',
        payload: {},
        status: 'pending',
        nextRetryAt: new Date(),
      })
      .returning();
    const hits = received.length;
    await deliverDueWebhooks();
    const [parkedAfter] = await systemDb()
      .select()
      .from(schema.webhookDeliveries)
      .where(eq(schema.webhookDeliveries.id, parked!.id));
    expect(parkedAfter!.status).toBe('failed');
    expect(parkedAfter!.nextRetryAt).toBeNull();
    expect(received.filter((r) => r.headers['x-raqeeb-delivery'] === parked!.id)).toHaveLength(0);
    expect(received.length).toBe(hits);
  }, 30_000);
});
