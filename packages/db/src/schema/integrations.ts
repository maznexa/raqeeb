import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { memberships, tenants } from './tenancy';

/**
 * Public webhooks (Wave B): Asana-discipline delivery — HMAC secret handshake at
 * registration, X-Raqeeb-Signature per delivery, exponential backoff, auto-suspend
 * with visible health (docs/05-api-design/04-webhooks.md).
 */
export const webhooks = pgTable(
  'webhooks',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    createdByMembershipId: uuid('created_by_membership_id').references(() => memberships.id, {
      onDelete: 'set null',
    }),
    url: text('url').notNull(),
    // Signing secret returned once at creation; stored to sign payloads.
    // Encrypt-at-rest via KMS is a P7 hardening item (documented).
    secret: text('secret').notNull(),
    // Event filters: exact names (task.created) or prefix wildcards (task.*, *)
    events: jsonb('events').notNull().default(sql`'["*"]'::jsonb`),
    status: text('status').notNull().default('active'), // active | suspended
    failureCount: integer('failure_count').notNull().default(0),
    // Start of the current failure streak — suspension requires BOTH the count
    // threshold AND a sustained window (anti "one burst suspends instantly").
    firstFailureAt: timestamp('first_failure_at', { withTimezone: true }),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('webhooks_tenant_idx').on(t.tenantId, t.status)],
);

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    webhookId: uuid('webhook_id')
      .notNull()
      .references(() => webhooks.id, { onDelete: 'cascade' }),
    outboxEventId: bigint('outbox_event_id', { mode: 'number' }).notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    status: text('status').notNull().default('pending'), // pending | success | failed
    attempts: integer('attempts').notNull().default(0),
    responseCode: integer('response_code'),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('webhook_deliveries_due_idx').on(t.status, t.nextRetryAt),
    index('webhook_deliveries_tenant_hook_idx').on(t.tenantId, t.webhookId, t.createdAt),
  ],
);

/**
 * Stripe webhook event dedupe (GLOBAL — no tenant_id, no RLS; touched only by the
 * billing module). Idempotent handlers: an event id already present = already processed.
 */
export const stripeEvents = pgTable('stripe_events', {
  id: text('id').primaryKey(), // Stripe event id (evt_...)
  type: text('type').notNull(),
  payload: jsonb('payload').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
