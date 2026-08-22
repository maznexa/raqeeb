import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { schema, systemDb } from '@raqeeb/db';
import { eq, sql } from 'drizzle-orm';
import { planForPrice } from './prices';
import { STRIPE_DRIVER, type StripeDriver, type StripeWebhookEvent } from './stripe.driver';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LocalStatus = 'trialing' | 'active' | 'past_due' | 'canceled';

/** Stripe subscription status → local enum. Convergent: unknown statuses change nothing. */
function mapSubscriptionStatus(status: unknown): LocalStatus | undefined {
  switch (status) {
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'active';
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled';
    default:
      return undefined;
  }
}

/** Stripe expands some refs to objects; we only ever need the id. */
function asId(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id;
    return typeof id === 'string' ? id : undefined;
  }
  return undefined;
}

function metadataOf(object: Record<string, unknown>): Record<string, unknown> {
  const meta = object.metadata;
  return meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {};
}

/**
 * Stripe webhook processing. Handlers are state-convergent (fields set to the
 * event's values, never incremented) and idempotent via the stripe_events
 * dedupe table — insert-first, conflict = already processed.
 *
 * All tenant updates run on systemDb: the webhook has no tenant principal;
 * billing sync is the documented cross-tenant escape hatch.
 */
@Injectable()
export class StripeWebhookService {
  constructor(@Inject(STRIPE_DRIVER) private readonly driver: StripeDriver) {}

  /** Verify (when STRIPE_WEBHOOK_SECRET is set) + parse the raw delivery. */
  parse(rawBody: Buffer | string, signature: string | undefined): StripeWebhookEvent {
    try {
      return this.driver.parseWebhookEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      throw new BadRequestException(`Invalid Stripe webhook payload: ${(err as Error).message}`);
    }
  }

  async handleEvent(event: StripeWebhookEvent): Promise<{ received: true; duplicate?: true }> {
    const db = systemDb();

    // Claim the event atomically. A brand-new event inserts; an event seen before
    // but NOT yet marked processed (a prior handler crashed) is re-claimed via the
    // conflict's setWhere so a Stripe retry actually reprocesses it — the old
    // insert-first-DO-NOTHING form dropped such events forever. A fully-processed
    // event matches neither branch → no row returned → true duplicate.
    const claimed = await db
      .insert(schema.stripeEvents)
      .values({ id: event.id, type: event.type, payload: event })
      .onConflictDoUpdate({
        target: schema.stripeEvents.id,
        set: { type: event.type },
        setWhere: sql`${schema.stripeEvents.processedAt} IS NULL`,
      })
      .returning({ id: schema.stripeEvents.id });
    if (claimed.length === 0) return { received: true, duplicate: true };

    const object = event.data?.object ?? {};
    const eventAt =
      typeof event.created === 'number' ? new Date(event.created * 1000) : undefined;
    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(object, eventAt);
        break;
      case 'customer.subscription.updated':
        await this.onSubscriptionUpdated(object, eventAt);
        break;
      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(object, eventAt);
        break;
      default:
        break; // unhandled types are acked and recorded, nothing else
    }

    await db
      .update(schema.stripeEvents)
      .set({ processedAt: new Date() })
      .where(eq(schema.stripeEvents.id, event.id));
    return { received: true };
  }

  /** True when this event predates the last billing event already applied to the tenant. */
  private isStale(tenant: { lastBillingEventAt: Date | null }, eventAt: Date | undefined): boolean {
    return Boolean(eventAt && tenant.lastBillingEventAt && eventAt < tenant.lastBillingEventAt);
  }

  private async onCheckoutCompleted(
    session: Record<string, unknown>,
    _eventAt: Date | undefined,
  ): Promise<void> {
    const meta = metadataOf(session);
    const tenantId =
      typeof session.client_reference_id === 'string'
        ? session.client_reference_id
        : typeof meta.tenantId === 'string'
          ? meta.tenantId
          : undefined;
    if (!tenantId || !UUID_RE.test(tenantId)) return; // orphan → reconciliation/human review

    const planId = meta.planId === 'pro' || meta.planId === 'business' ? meta.planId : undefined;
    const customerId = asId(session.customer);
    const subscriptionId = asId(session.subscription);

    // Link ids + plan only. subscriptionStatus is owned exclusively by the
    // customer.subscription.* events, so a checkout that opens a trial is not
    // clobbered to 'active' here (the following subscription event sets it right).
    await systemDb()
      .update(schema.tenants)
      .set({
        ...(customerId && { stripeCustomerId: customerId }),
        ...(subscriptionId && { stripeSubscriptionId: subscriptionId }),
        ...(planId && { planId }),
        updatedAt: new Date(),
      })
      .where(eq(schema.tenants.id, tenantId));
  }

  private async onSubscriptionUpdated(
    sub: Record<string, unknown>,
    eventAt: Date | undefined,
  ): Promise<void> {
    const tenant = await this.findTenantForSubscription(sub);
    if (!tenant || this.isStale(tenant, eventAt)) return;

    const status = mapSubscriptionStatus(sub.status);
    const items = sub.items as { data?: Array<{ price?: { id?: unknown } }> } | undefined;
    const priceId = asId(items?.data?.[0]?.price);
    const planId = priceId ? planForPrice(priceId) : undefined;
    const subscriptionId = typeof sub.id === 'string' ? sub.id : undefined;
    const customerId = asId(sub.customer);

    await systemDb()
      .update(schema.tenants)
      .set({
        ...(status && { subscriptionStatus: status }),
        ...(planId && { planId }),
        ...(subscriptionId && { stripeSubscriptionId: subscriptionId }),
        ...(customerId && { stripeCustomerId: customerId }),
        ...(eventAt && { lastBillingEventAt: eventAt }),
        updatedAt: new Date(),
      })
      .where(eq(schema.tenants.id, tenant.id));
  }

  private async onSubscriptionDeleted(
    sub: Record<string, unknown>,
    eventAt: Date | undefined,
  ): Promise<void> {
    const tenant = await this.findTenantForSubscription(sub);
    if (!tenant || this.isStale(tenant, eventAt)) return;

    // Deletion fires at period end: drop to Free entitlements, keep the
    // customer link for painless re-subscription. Nothing is ever deleted.
    // lastBillingEventAt is stamped so a delayed subscription.updated that Stripe
    // delivers out of order afterward is rejected as stale (no resurrection).
    await systemDb()
      .update(schema.tenants)
      .set({
        subscriptionStatus: 'canceled',
        planId: 'free',
        stripeSubscriptionId: null,
        ...(eventAt && { lastBillingEventAt: eventAt }),
        updatedAt: new Date(),
      })
      .where(eq(schema.tenants.id, tenant.id));
  }

  private async findTenantForSubscription(sub: Record<string, unknown>) {
    const db = systemDb();
    const subId = typeof sub.id === 'string' ? sub.id : undefined;
    if (subId) {
      const t = await db.query.tenants.findFirst({
        where: eq(schema.tenants.stripeSubscriptionId, subId),
      });
      if (t) return t;
    }
    const customerId = asId(sub.customer);
    if (customerId) {
      const t = await db.query.tenants.findFirst({
        where: eq(schema.tenants.stripeCustomerId, customerId),
      });
      if (t) return t;
    }
    const metaTenant = metadataOf(sub).tenantId;
    if (typeof metaTenant === 'string' && UUID_RE.test(metaTenant)) {
      return db.query.tenants.findFirst({ where: eq(schema.tenants.id, metaTenant) });
    }
    return undefined;
  }
}
