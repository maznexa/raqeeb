import { z } from 'zod';

/**
 * Zod-validated environment. Parsed once at bootstrap — the process refuses to
 * start with an invalid configuration rather than failing at first use.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_SYSTEM: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),
  JWT_ACCESS_TTL: z.coerce.number().int().default(900), // seconds
  JWT_REFRESH_TTL: z.coerce.number().int().default(2_592_000), // 30 days
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  // Billing: unset locally/CI → deterministic FakeStripeDriver. When a real key
  // is present the webhook secret becomes mandatory (see superRefine) so a keyed
  // deploy can never silently accept forged, unverified billing events.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
}).superRefine((val, ctx) => {
  if (val.STRIPE_SECRET_KEY && !val.STRIPE_WEBHOOK_SECRET) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['STRIPE_WEBHOOK_SECRET'],
      message: 'STRIPE_WEBHOOK_SECRET is required whenever STRIPE_SECRET_KEY is set',
    });
  }
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function env(): Env {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
      throw new Error('Invalid environment configuration');
    }
    cached = parsed.data;
  }
  return cached;
}
