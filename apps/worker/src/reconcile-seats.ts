import { schema, systemDb } from '@raqeeb/db';
import { and, count, eq, isNotNull, notInArray } from 'drizzle-orm';
import pino from 'pino';

const log = pino({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' });

/**
 * Daily seat reconciliation (docs/06-saas-commercial/03-billing-stripe.md,
 * `reconciliation` queue family). Deliberately self-contained: the seat rule
 * and driver selection are duplicated from the API's billing module rather
 * than imported, so the worker never depends on API code.
 *
 * Explicitly cross-tenant: runs on systemDb (documented escape hatch —
 * "billing reconciliation" in packages/db/src/client.ts).
 */

interface SeatQuantityDriver {
  setSubscriptionQuantity(subscriptionId: string, quantity: number): Promise<void>;
}

/** In-memory driver used whenever STRIPE_SECRET_KEY is unset (local, CI, sandboxes). */
export class FakeSeatDriver implements SeatQuantityDriver {
  readonly subscriptionQuantities = new Map<string, number>();

  async setSubscriptionQuantity(subscriptionId: string, quantity: number): Promise<void> {
    this.subscriptionQuantities.set(subscriptionId, quantity);
  }
}

interface StripeSubscriptionsClient {
  subscriptions: {
    retrieve(id: string): Promise<{ items: { data: Array<{ id: string }> } }>;
    update(id: string, params: Record<string, unknown>): Promise<unknown>;
  };
}

async function realSeatDriver(secretKey: string): Promise<SeatQuantityDriver> {
  // Loaded dynamically so no-key environments never resolve the stripe package
  // (it is an API-side dependency; add it to the worker before enabling real keys).
  const specifier: string = 'stripe';
  const mod = (await import(specifier)) as { default: new (key: string) => StripeSubscriptionsClient };
  const stripe = new mod.default(secretKey);
  return {
    async setSubscriptionQuantity(subscriptionId, quantity) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const item = sub.items.data[0];
      if (!item) throw new Error(`Subscription ${subscriptionId} has no items`);
      await stripe.subscriptions.update(subscriptionId, {
        items: [{ id: item.id, quantity }],
        proration_behavior: 'create_prorations',
      });
    },
  };
}

let defaultDriver: SeatQuantityDriver | undefined;

async function driverFromEnv(): Promise<SeatQuantityDriver> {
  if (!defaultDriver) {
    const key = process.env.STRIPE_SECRET_KEY;
    defaultDriver = key ? await realSeatDriver(key) : new FakeSeatDriver();
  }
  return defaultDriver;
}

/** THE seat rule, duplicated by design (see module comment). */
async function countBillableSeats(tenantId: string): Promise<number> {
  const [row] = await systemDb()
    .select({ n: count() })
    .from(schema.memberships)
    .where(
      and(
        eq(schema.memberships.tenantId, tenantId),
        eq(schema.memberships.isBillableSeat, true),
        eq(schema.memberships.status, 'active'),
        notInArray(schema.memberships.role, ['guest', 'client']),
      ),
    );
  return row?.n ?? 0;
}

export interface SeatReconciliationResult {
  scanned: number;
  synced: number;
  failed: number;
}

export async function reconcileSeatsOnce(
  driver?: SeatQuantityDriver,
): Promise<SeatReconciliationResult> {
  const d = driver ?? (await driverFromEnv());
  const tenants = await systemDb()
    .select({ id: schema.tenants.id, stripeSubscriptionId: schema.tenants.stripeSubscriptionId })
    .from(schema.tenants)
    .where(isNotNull(schema.tenants.stripeSubscriptionId));

  let synced = 0;
  let failed = 0;
  for (const t of tenants) {
    if (!t.stripeSubscriptionId) continue;
    try {
      const seats = await countBillableSeats(t.id);
      await d.setSubscriptionQuantity(t.stripeSubscriptionId, Math.max(1, seats));
      synced++;
    } catch (err) {
      // One broken tenant must not stop the sweep; drift shows up in the next pass.
      failed++;
      log.error({ tenantId: t.id, err: (err as Error).message }, 'seat reconciliation failed for tenant');
    }
  }
  return { scanned: tenants.length, synced, failed };
}

/** Runs one pass immediately, then every intervalMs (default daily). Returns a stop fn. */
export function startSeatReconciliation(intervalMs = 86_400_000): () => void {
  let running = false;
  const tick = async () => {
    if (running) return; // overlap guard for slow Stripe round-trips
    running = true;
    try {
      const res = await reconcileSeatsOnce();
      if (res.scanned > 0) log.info(res, 'seat reconciliation pass complete');
    } catch (err) {
      log.error({ err: (err as Error).message }, 'seat reconciliation pass failed');
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), intervalMs);
  return () => clearInterval(timer);
}
