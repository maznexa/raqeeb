import { Inject, Injectable } from '@nestjs/common';
import { schema, systemDb } from '@raqeeb/db';
import { eq } from 'drizzle-orm';
import { countBillableSeats } from './seats';
import { STRIPE_DRIVER, type StripeDriver } from './stripe.driver';

/**
 * Pushes local billable-seat truth to Stripe on membership transitions
 * (invite accepted, role change crossing the billable line, deactivation).
 * The worker's daily reconciliation (apps/worker/src/reconcile-seats.ts) is
 * the safety net for pushes this path misses.
 */
@Injectable()
export class SeatSyncService {
  constructor(@Inject(STRIPE_DRIVER) private readonly driver: StripeDriver) {}

  async syncSeats(tenantId: string): Promise<{ seats: number; pushed: boolean }> {
    const tenant = await systemDb().query.tenants.findFirst({
      where: eq(schema.tenants.id, tenantId),
    });
    if (!tenant?.stripeSubscriptionId) return { seats: 0, pushed: false };

    const seats = await countBillableSeats(tenantId);
    await this.driver.setSubscriptionQuantity(tenant.stripeSubscriptionId, Math.max(1, seats));
    return { seats, pushed: true };
  }
}
