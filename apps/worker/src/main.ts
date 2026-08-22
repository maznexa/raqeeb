import { schema, systemDb } from '@raqeeb/db';
import { Queue, Worker } from 'bullmq';
import { asc, eq, isNull } from 'drizzle-orm';
import Redis from 'ioredis';
import pino from 'pino';
import { startSeatReconciliation } from './reconcile-seats';
import { tenantProcessor } from './tenant-processor';
import {
  closeWebhookDelivery,
  deliverDueWebhooks,
  fanoutOutboxToWebhooks,
} from './webhook-delivery';

const log = pino({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' });
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

/**
 * Scaffold worker, two responsibilities:
 *
 * 1. OUTBOX PUBLISHER — polls unpublished outbox_events (system pool: publishing is
 *    a cross-tenant system operation), publishes each to the Redis channel
 *    `raqeeb:tenant:{tenantId}:events`, marks it published. The P2 realtime gateway
 *    subscribes to these channels and fans out to Socket.IO rooms; webhook delivery
 *    consumes the same stream.
 *
 * 2. QUEUE SCAFFOLD — the `maintenance` queue demonstrates the tenantProcessor
 *    guard rail that all future queues (automations, notifications, webhooks,
 *    digests, rebalance) must use.
 */
const publisher = new Redis(REDIS_URL);
const connection = { url: REDIS_URL };

async function publishOutboxBatch(): Promise<number> {
  const db = systemDb();
  const rows = await db
    .select()
    .from(schema.outboxEvents)
    .where(isNull(schema.outboxEvents.publishedAt))
    .orderBy(asc(schema.outboxEvents.id))
    .limit(100);

  for (const row of rows) {
    await publisher.publish(
      `raqeeb:tenant:${row.tenantId}:events`,
      JSON.stringify({
        id: row.id,
        type: row.eventType,
        entityType: row.entityType,
        entityId: row.entityId,
        payload: row.payload,
        createdAt: row.createdAt,
      }),
    );
    await db
      .update(schema.outboxEvents)
      .set({ publishedAt: new Date() })
      .where(eq(schema.outboxEvents.id, row.id));
  }
  return rows.length;
}

const maintenanceQueue = new Queue('maintenance', { connection });

const maintenanceWorker = new Worker(
  'maintenance',
  tenantProcessor(async (_db, job) => {
    log.info({ job: job.name, tenantId: job.data.tenantId }, 'maintenance job executed');
  }),
  { connection },
);
maintenanceWorker.on('failed', (job, err) =>
  log.error({ job: job?.name, err: err.message }, 'job failed'),
);

async function main() {
  log.info('Raqeeb worker started (outbox publisher + webhook delivery + queues)');
  let stopping = false;
  const stopSeatReconciliation = startSeatReconciliation();
  const stop = async () => {
    stopping = true;
    stopSeatReconciliation();
    closeWebhookDelivery();
    await maintenanceWorker.close();
    await maintenanceQueue.close();
    publisher.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  while (!stopping) {
    try {
      const n = await publishOutboxBatch();
      if (n > 0) log.debug({ published: n }, 'outbox batch published');
      // Drain bursts: fan out until the cursor catches up, then attempt due deliveries.
      let scanned: number;
      do {
        scanned = await fanoutOutboxToWebhooks();
      } while (scanned > 0);
      await deliverDueWebhooks();
    } catch (err) {
      log.error({ err: (err as Error).message }, 'worker tick failed');
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

void main();
