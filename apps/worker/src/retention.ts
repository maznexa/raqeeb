import { schema, systemDb } from '@raqeeb/db';
import { and, eq, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import pino from 'pino';

const log = pino({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' });

/**
 * Retention sweep (review finding: webhook_deliveries / stripe_events / outbox
 * grow without bound). Policy per the delivery-log promise in the API docs:
 *  - successful deliveries kept 30 days, terminal failures 90 days
 *  - processed stripe_events kept 90 days (the dedupe window only needs recent ids)
 *  - published+fanned outbox events kept 30 days
 */
const DAY_MS = 86_400_000;

export async function retentionSweepOnce(): Promise<Record<string, number>> {
  const db = systemDb();
  const now = Date.now();
  const removed: Record<string, number> = {};

  const successCutoff = new Date(now - 30 * DAY_MS);
  const failedCutoff = new Date(now - 90 * DAY_MS);
  const okDel = await db
    .delete(schema.webhookDeliveries)
    .where(
      and(
        eq(schema.webhookDeliveries.status, 'success'),
        lt(schema.webhookDeliveries.createdAt, successCutoff),
      ),
    )
    .returning({ id: schema.webhookDeliveries.id });
  const failDel = await db
    .delete(schema.webhookDeliveries)
    .where(
      and(
        inArray(schema.webhookDeliveries.status, ['failed']),
        sql`${schema.webhookDeliveries.nextRetryAt} IS NULL`, // terminal only
        lt(schema.webhookDeliveries.createdAt, failedCutoff),
      ),
    )
    .returning({ id: schema.webhookDeliveries.id });
  removed.webhookDeliveries = okDel.length + failDel.length;

  const stripeDel = await db
    .delete(schema.stripeEvents)
    .where(
      and(isNotNull(schema.stripeEvents.processedAt), lt(schema.stripeEvents.createdAt, failedCutoff)),
    )
    .returning({ id: schema.stripeEvents.id });
  removed.stripeEvents = stripeDel.length;

  const outboxDel = await db
    .delete(schema.outboxEvents)
    .where(
      and(
        isNotNull(schema.outboxEvents.publishedAt),
        isNotNull(schema.outboxEvents.fannedOutAt),
        lt(schema.outboxEvents.createdAt, successCutoff),
      ),
    )
    .returning({ id: schema.outboxEvents.id });
  removed.outboxEvents = outboxDel.length;

  return removed;
}

/** Daily sweep; returns a stop fn. */
export function startRetentionSweep(intervalMs = DAY_MS): () => void {
  const tick = async () => {
    try {
      const removed = await retentionSweepOnce();
      const total = Object.values(removed).reduce((a, b) => a + b, 0);
      if (total > 0) log.info(removed, 'retention sweep complete');
    } catch (err) {
      log.error({ err: (err as Error).message }, 'retention sweep failed');
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), intervalMs);
  return () => clearInterval(timer);
}
