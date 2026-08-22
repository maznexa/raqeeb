/**
 * Stripe price ids come from the environment (one per plan × interval).
 * The price_fake_* fallbacks keep no-key environments (local, CI, this sandbox)
 * deterministic end-to-end with the FakeStripeDriver.
 */
const PRICES = {
  pro: {
    month: { env: 'STRIPE_PRICE_PRO_MONTH', fallback: 'price_fake_pro_month' },
    year: { env: 'STRIPE_PRICE_PRO_YEAR', fallback: 'price_fake_pro_year' },
  },
  business: {
    month: { env: 'STRIPE_PRICE_BUSINESS_MONTH', fallback: 'price_fake_business_month' },
    year: { env: 'STRIPE_PRICE_BUSINESS_YEAR', fallback: 'price_fake_business_year' },
  },
} as const;

export type BillablePlanId = keyof typeof PRICES; // 'pro' | 'business'
export type BillingInterval = 'month' | 'year';

export function priceFor(planId: BillablePlanId, interval: BillingInterval): string {
  const entry = PRICES[planId][interval];
  return process.env[entry.env] ?? entry.fallback;
}

/** Reverse lookup for webhook convergence: which plan does a Stripe price belong to? */
export function planForPrice(priceId: string): BillablePlanId | undefined {
  for (const planId of Object.keys(PRICES) as BillablePlanId[]) {
    for (const interval of ['month', 'year'] as const) {
      if (priceFor(planId, interval) === priceId) return planId;
    }
  }
  return undefined;
}
