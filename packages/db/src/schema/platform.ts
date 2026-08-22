import { sql } from 'drizzle-orm';
import {
  bigserial,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { memberships, tenants } from './tenancy';

/**
 * Platform tables: public-API tokens, audit trail, realtime outbox.
 */
export const personalAccessTokens = pgTable(
  'personal_access_tokens',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => memberships.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // Full token: raq_pat_<base62>. We store the SHA-256 hash; prefix column allows O(1) lookup.
    tokenPrefix: text('token_prefix').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('pats_token_prefix_idx').on(t.tokenPrefix),
    index('pats_tenant_membership_idx').on(t.tenantId, t.membershipId),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    actorMembershipId: uuid('actor_membership_id').references(() => memberships.id, {
      onDelete: 'set null',
    }),
    actorType: text('actor_type').notNull().default('user'), // user | api | system
    action: text('action').notNull(), // e.g. task.create, membership.invite
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_logs_tenant_created_idx').on(t.tenantId, t.createdAt)],
);

/**
 * Transactional outbox: entity changes recorded in the same transaction as the write,
 * published to Redis pub/sub → Socket.IO by the worker (at-least-once).
 */
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(), // e.g. task.created, task.status_changed
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    // Webhook fan-out progress lives HERE, not in a Redis cursor: a durable
    // per-row marker survives Redis flushes and never skips out-of-order commits.
    fannedOutAt: timestamp('fanned_out_at', { withTimezone: true }),
  },
  (t) => [
    index('outbox_unpublished_idx').on(t.publishedAt, t.id),
    index('outbox_unfanned_idx').on(t.id).where(sql`fanned_out_at IS NULL`),
  ],
);
