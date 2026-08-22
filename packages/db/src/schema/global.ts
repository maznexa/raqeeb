import { sql } from 'drizzle-orm';
import { index, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Global tables — NOT tenant-scoped, NOT under RLS.
 * D9: identity is cross-tenant; one account belongs to N tenants via memberships.
 */

export const plans = pgTable('plans', {
  id: text('id').primaryKey(), // 'free' | 'pro' | 'business' | 'enterprise'
  name: text('name').notNull(),
  monthlyPricePerSeat: numeric('monthly_price_per_seat', { precision: 10, scale: 2 })
    .notNull()
    .default('0'),
  // Boolean/limit entitlements; single enforcement point reads this (EntitlementsService).
  features: jsonb('features').notNull().default(sql`'{}'::jsonb`),
  limits: jsonb('limits').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash'),
    displayName: text('display_name').notNull(),
    locale: text('locale').notNull().default('en'), // 'en' | 'ar'
    timezone: text('timezone').notNull().default('UTC'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('accounts_email_idx').on(t.email)],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('refresh_tokens_account_idx').on(t.accountId)],
);
