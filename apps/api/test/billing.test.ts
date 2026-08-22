import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { closePools, schema, systemDb } from '@raqeeb/db';
import { eq, inArray, like } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TenantContext } from '../src/auth/decorators';
import { BillingService } from '../src/billing/billing.service';
import { SeatSyncService } from '../src/billing/seat-sync.service';
import { StripeWebhookService } from '../src/billing/stripe-webhook.service';
import { FakeStripeDriver, type StripeWebhookEvent } from '../src/billing/stripe.driver';
import { AuditService } from '../src/platform/audit.service';

/**
 * Billing suite against real Postgres (fixture pattern from packages/db/test/rls.test.ts).
 * Requires a migrated database; CI runs `pnpm db:migrate` first.
 */

process.env.DATABASE_URL ??= 'postgres://raqeeb_app:raqeeb_app@localhost:5432/raqeeb';
process.env.DATABASE_URL_SYSTEM ??= 'postgres://raqeeb_system:raqeeb_system@localhost:5432/raqeeb';

const STAMP = Date.now().toString(36);
const EVT = (name: string) => `evt_${STAMP}_${name}`;
const SUB = `sub_${STAMP}`;
const CUS = `cus_${STAMP}`;

const fake = new FakeStripeDriver();
const billing = new BillingService(fake, new AuditService());
const webhooks = new StripeWebhookService(fake);
const seatSync = new SeatSyncService(fake);

let tenantId: string;
let ownerCtx: TenantContext;
let memberCtx: TenantContext;
let clientCtx: TenantContext;
const accountIds: string[] = [];

async function makeMembership(
  role: 'owner' | 'admin' | 'member' | 'guest' | 'client',
  opts: { billable?: boolean; status?: string } = {},
) {
  const db = systemDb();
  const [account] = await db
    .insert(schema.accounts)
    .values({
      email: `billing-${STAMP}-${accountIds.length}@test.local`,
      displayName: `${role} ${accountIds.length}`,
    })
    .returning();
  accountIds.push(account!.id);
  const [m] = await db
    .insert(schema.memberships)
    .values({
      tenantId,
      accountId: account!.id,
      role,
      ...(opts.billable !== undefined && { isBillableSeat: opts.billable }),
      ...(opts.status !== undefined && { status: opts.status }),
    })
    .returning();
  return m!;
}

async function tenantRow() {
  const t = await systemDb().query.tenants.findFirst({ where: eq(schema.tenants.id, tenantId) });
  expect(t).toBeDefined();
  return t!;
}

const ctx = (membershipId: string, role: TenantContext['role']): TenantContext => ({
  tenantId,
  membershipId,
  role,
});

beforeAll(async () => {
  const db = systemDb();
  await db
    .insert(schema.plans)
    .values([
      { id: 'free', name: 'Free', monthlyPricePerSeat: '0' },
      { id: 'pro', name: 'Pro', monthlyPricePerSeat: '9' },
      { id: 'business', name: 'Business', monthlyPricePerSeat: '19' },
    ])
    .onConflictDoNothing();

  const [tenant] = await db
    .insert(schema.tenants)
    .values({ name: 'Billing Test', slug: `billing-${STAMP}`, planId: 'free' })
    .returning();
  tenantId = tenant!.id;

  const owner = await makeMembership('owner');
  const admin = await makeMembership('admin');
  const member = await makeMembership('member');
  await makeMembership('member', { status: 'suspended' }); // seat freed on deactivation
  await makeMembership('guest', { billable: false });
  // Deliberately mis-set flag: the role exclusion must still keep clients free.
  const client = await makeMembership('client', { billable: true });

  ownerCtx = ctx(owner.id, 'owner');
  memberCtx = ctx(member.id, 'member');
  clientCtx = ctx(client.id, 'client');
  void admin;
});

afterAll(async () => {
  const db = systemDb();
  await db.delete(schema.stripeEvents).where(like(schema.stripeEvents.id, `evt_${STAMP}%`));
  if (tenantId) await db.delete(schema.tenants).where(eq(schema.tenants.id, tenantId));
  if (accountIds.length > 0)
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, accountIds));
  await closePools();
});

describe('billable seat counting', () => {
  it('counts only active billable seats — clients, guests, suspended never count', async () => {
    const status = await billing.status(ownerCtx);
    // owner + admin + member; NOT: suspended member, guest, client (even with flag mis-set)
    expect(status.billableSeats).toBe(3);
  });

  it('reports plan/status defaults with readOnly=false', async () => {
    const status = await billing.status(ownerCtx);
    expect(status.planId).toBe('free');
    expect(status.subscriptionStatus).toBe('trialing');
    expect(status.readOnly).toBe(false);
  });
});

describe('checkout', () => {
  it('rejects non-admin roles', async () => {
    await expect(
      billing.startCheckout(memberCtx, { planId: 'pro', interval: 'month' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      billing.startCheckout(clientCtx, { planId: 'pro', interval: 'month' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates a checkout session with exact seat quantity and env/fallback price', async () => {
    const { url } = await billing.startCheckout(ownerCtx, { planId: 'pro', interval: 'month' });
    expect(url).toContain('checkout.stripe.fake');
    const session = fake.checkoutSessions.at(-1)!;
    expect(session.tenantId).toBe(tenantId);
    expect(session.quantity).toBe(3);
    expect(session.priceId).toBe('price_fake_pro_month');
  });

  it('portal is rejected while no Stripe customer is linked', async () => {
    await expect(billing.portal(ownerCtx)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('stripe webhook', () => {
  it('checkout.session.completed links Stripe ids and sets the plan', async () => {
    const event: StripeWebhookEvent = {
      id: EVT('checkout'),
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          client_reference_id: tenantId,
          customer: CUS,
          subscription: SUB,
          metadata: { tenantId, planId: 'pro' },
        },
      },
    };
    const res = await webhooks.handleEvent(event);
    expect(res).toEqual({ received: true });

    const t = await tenantRow();
    expect(t.planId).toBe('pro');
    expect(t.subscriptionStatus).toBe('active');
    expect(t.stripeCustomerId).toBe(CUS);
    expect(t.stripeSubscriptionId).toBe(SUB);

    const [row] = await systemDb()
      .select()
      .from(schema.stripeEvents)
      .where(eq(schema.stripeEvents.id, EVT('checkout')));
    expect(row?.processedAt).not.toBeNull();
  });

  it('the same event id twice causes exactly one state change', async () => {
    // Undo the first apply out-of-band, then replay the identical event.
    await systemDb()
      .update(schema.tenants)
      .set({ planId: 'free' })
      .where(eq(schema.tenants.id, tenantId));

    const replay: StripeWebhookEvent = {
      id: EVT('checkout'),
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          client_reference_id: tenantId,
          customer: CUS,
          subscription: SUB,
          metadata: { tenantId, planId: 'pro' },
        },
      },
    };
    const res = await webhooks.handleEvent(replay);
    expect(res).toEqual({ received: true, duplicate: true });

    const t = await tenantRow();
    expect(t.planId).toBe('free'); // replay did NOT re-apply

    const rows = await systemDb()
      .select()
      .from(schema.stripeEvents)
      .where(eq(schema.stripeEvents.id, EVT('checkout')));
    expect(rows).toHaveLength(1);
  });

  it('subscription.updated maps statuses and syncs plan from the price id', async () => {
    const cases: Array<[string, string, string]> = [
      ['past-due', 'past_due', 'past_due'],
      ['trialing', 'trialing', 'trialing'],
      ['unpaid', 'unpaid', 'past_due'],
      ['active', 'active', 'active'],
    ];
    for (const [name, stripeStatus, localStatus] of cases) {
      await webhooks.handleEvent({
        id: EVT(`sub-${name}`),
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: SUB,
            customer: CUS,
            status: stripeStatus,
            items: { data: [{ price: { id: 'price_fake_business_month' } }] },
          },
        },
      });
      const t = await tenantRow();
      expect(t.subscriptionStatus).toBe(localStatus);
      expect(t.planId).toBe('business'); // reverse price lookup
    }
  });

  it('past_due drives readOnly=true in billing status', async () => {
    await webhooks.handleEvent({
      id: EVT('sub-readonly'),
      type: 'customer.subscription.updated',
      data: { object: { id: SUB, customer: CUS, status: 'past_due' } },
    });
    const status = await billing.status(memberCtx);
    expect(status.subscriptionStatus).toBe('past_due');
    expect(status.readOnly).toBe(true);
  });

  it('subscription.deleted drops to free/canceled and unlinks the subscription', async () => {
    await webhooks.handleEvent({
      id: EVT('sub-deleted'),
      type: 'customer.subscription.deleted',
      data: { object: { id: SUB, customer: CUS, status: 'canceled' } },
    });
    const t = await tenantRow();
    expect(t.subscriptionStatus).toBe('canceled');
    expect(t.planId).toBe('free');
    expect(t.stripeSubscriptionId).toBeNull();
    expect(t.stripeCustomerId).toBe(CUS); // customer link survives for re-subscription
  });

  it('portal works once a customer is linked', async () => {
    const { url } = await billing.portal(ownerCtx);
    expect(url).toContain(CUS);
  });

  it('driver parse round-trips raw payloads and rejects non-events', () => {
    const event = { id: EVT('parse'), type: 'noop', data: { object: {} } };
    const parsed = fake.parseWebhookEvent(Buffer.from(JSON.stringify(event)), undefined, undefined);
    expect(parsed.id).toBe(EVT('parse'));
    expect(() => fake.parseWebhookEvent(Buffer.from('{"nope":1}'), undefined, undefined)).toThrow();
  });
});

describe('seat sync', () => {
  it('is a no-op for tenants without a subscription', async () => {
    const res = await seatSync.syncSeats(tenantId); // unlinked by subscription.deleted above
    expect(res).toEqual({ seats: 0, pushed: false });
    expect(fake.subscriptionQuantities.has(SUB)).toBe(false);
  });

  it('pushes the exact billable seat count to the driver', async () => {
    await systemDb()
      .update(schema.tenants)
      .set({ stripeSubscriptionId: SUB })
      .where(eq(schema.tenants.id, tenantId));

    const res = await seatSync.syncSeats(tenantId);
    expect(res).toEqual({ seats: 3, pushed: true });
    expect(fake.subscriptionQuantities.get(SUB)).toBe(3);
  });
});
