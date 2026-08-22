import Stripe from 'stripe';

/**
 * Thin seam over the Stripe SDK so every code path (API, tests, CI, sandboxes
 * without Stripe network access) runs the same billing logic. RealStripeDriver
 * is selected iff STRIPE_SECRET_KEY is set; otherwise the deterministic
 * in-memory FakeStripeDriver takes its place.
 */

/** Normalized event shape shared by both drivers (structural subset of Stripe.Event). */
export interface StripeWebhookEvent {
  id: string;
  type: string;
  created?: number; // Stripe event creation time (unix seconds) — used for ordering
  data: { object: Record<string, unknown> };
}

export interface CreateCheckoutSessionParams {
  tenantId: string;
  planId: string;
  priceId: string;
  quantity: number;
  customerId?: string | null;
  successUrl: string;
  cancelUrl: string;
}

export interface StripeDriver {
  createCheckoutSession(params: CreateCheckoutSessionParams): Promise<{ id: string; url: string }>;
  createPortalSession(params: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
  /** quantity = exact billable seat count; proration is Stripe-side (create_prorations). */
  setSubscriptionQuantity(subscriptionId: string, quantity: number): Promise<void>;
  /** Verifies the signature when a webhook secret is configured; parses unverified otherwise (dev only). */
  parseWebhookEvent(
    rawBody: Buffer | string,
    signature: string | undefined,
    webhookSecret: string | undefined,
  ): StripeWebhookEvent;
}

function parseUnverified(rawBody: Buffer | string): StripeWebhookEvent {
  const parsed = JSON.parse(
    typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'),
  ) as StripeWebhookEvent;
  if (typeof parsed?.id !== 'string' || typeof parsed?.type !== 'string') {
    throw new Error('Payload is not a Stripe event');
  }
  return parsed;
}

export class RealStripeDriver implements StripeDriver {
  private readonly stripe: Stripe;

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey);
  }

  async createCheckoutSession(p: CreateCheckoutSessionParams): Promise<{ id: string; url: string }> {
    // tenantId travels on client_reference_id + metadata (session AND subscription)
    // so every later webhook can be tied back to the tenant.
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: p.priceId, quantity: p.quantity }],
      client_reference_id: p.tenantId,
      ...(p.customerId ? { customer: p.customerId } : {}),
      success_url: p.successUrl,
      cancel_url: p.cancelUrl,
      metadata: { tenantId: p.tenantId, planId: p.planId },
      subscription_data: { metadata: { tenantId: p.tenantId, planId: p.planId } },
    });
    if (!session.url) throw new Error('Stripe returned a checkout session without a URL');
    return { id: session.id, url: session.url };
  }

  async createPortalSession(p: { customerId: string; returnUrl: string }): Promise<{ url: string }> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: p.customerId,
      return_url: p.returnUrl,
    });
    return { url: session.url };
  }

  async setSubscriptionQuantity(subscriptionId: string, quantity: number): Promise<void> {
    const sub = await this.stripe.subscriptions.retrieve(subscriptionId);
    const item = sub.items.data[0];
    if (!item) throw new Error(`Subscription ${subscriptionId} has no items`);
    await this.stripe.subscriptions.update(subscriptionId, {
      items: [{ id: item.id, quantity }],
      proration_behavior: 'create_prorations',
    });
  }

  parseWebhookEvent(
    rawBody: Buffer | string,
    signature: string | undefined,
    webhookSecret: string | undefined,
  ): StripeWebhookEvent {
    // Fail CLOSED: a real Stripe key without a webhook secret must never accept an
    // unverified event. env() already refuses to boot in that state; this is the
    // defense-in-depth backstop so the driver can't be tricked into parseUnverified.
    if (!webhookSecret) {
      throw new Error(
        'Refusing to process an unverified Stripe webhook: STRIPE_WEBHOOK_SECRET is not set',
      );
    }
    if (!signature) throw new Error('Missing stripe-signature header');
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    ) as unknown as StripeWebhookEvent;
  }
}

/**
 * Deterministic in-memory driver. Never verifies signatures — environments
 * without STRIPE_SECRET_KEY have no Stripe secrets to verify against.
 * Public arrays/maps exist for test assertions.
 */
export class FakeStripeDriver implements StripeDriver {
  private seq = 0;
  readonly checkoutSessions: Array<CreateCheckoutSessionParams & { id: string; url: string }> = [];
  readonly portalSessions: Array<{ customerId: string; returnUrl: string; url: string }> = [];
  readonly subscriptionQuantities = new Map<string, number>();

  async createCheckoutSession(p: CreateCheckoutSessionParams): Promise<{ id: string; url: string }> {
    const id = `cs_fake_${++this.seq}`;
    const url = `https://checkout.stripe.fake/pay/${id}`;
    this.checkoutSessions.push({ ...p, id, url });
    return { id, url };
  }

  async createPortalSession(p: { customerId: string; returnUrl: string }): Promise<{ url: string }> {
    const url = `https://billing.stripe.fake/portal/${p.customerId}`;
    this.portalSessions.push({ ...p, url });
    return { url };
  }

  async setSubscriptionQuantity(subscriptionId: string, quantity: number): Promise<void> {
    this.subscriptionQuantities.set(subscriptionId, quantity);
  }

  parseWebhookEvent(
    rawBody: Buffer | string,
    _signature: string | undefined,
    _webhookSecret: string | undefined,
  ): StripeWebhookEvent {
    return parseUnverified(rawBody);
  }
}

export function createStripeDriverFromEnv(): StripeDriver {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new RealStripeDriver(key) : new FakeStripeDriver();
}

export const STRIPE_DRIVER = 'STRIPE_DRIVER';

/** Register in AppModule providers; consumers use @Inject(STRIPE_DRIVER). */
export const stripeDriverProvider = {
  provide: STRIPE_DRIVER,
  useFactory: createStripeDriverFromEnv,
};
