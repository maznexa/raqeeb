import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { membershipRole, subscriptionStatus } from './enums';
import { accounts, plans } from './global';

/**
 * D9: tenant = the billing/workspace org (1:1, no separate workspace layer).
 * RLS: tenants is self-scoped (id = current tenant); everything else scopes by tenant_id.
 */
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    planId: text('plan_id')
      .notNull()
      .default('free')
      .references(() => plans.id),
    subscriptionStatus: subscriptionStatus('subscription_status').notNull().default('trialing'),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    stripeCustomerId: text('stripe_customer_id').unique(),
    stripeSubscriptionId: text('stripe_subscription_id').unique(),
    defaultLocale: text('default_locale').notNull().default('en'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('tenants_slug_idx').on(t.slug)],
);

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    role: membershipRole('role').notNull().default('member'),
    // Clients & guests are NEVER billable (Teamwork lesson — free client users).
    isBillableSeat: boolean('is_billable_seat').notNull().default(true),
    // Per-tenant profile
    displayName: text('display_name'),
    weeklyCapacityMinutes: integer('weekly_capacity_minutes').notNull().default(2400), // 40h
    status: text('status').notNull().default('active'), // active | suspended | removed
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('memberships_tenant_account_uq').on(t.tenantId, t.accountId),
    index('memberships_account_idx').on(t.accountId),
    index('memberships_tenant_idx').on(t.tenantId),
  ],
);

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: membershipRole('role').notNull().default('member'),
    tokenHash: text('token_hash').notNull().unique(),
    invitedByMembershipId: uuid('invited_by_membership_id').references(() => memberships.id, {
      onDelete: 'set null',
    }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('invitations_tenant_email_idx').on(t.tenantId, t.email)],
);
