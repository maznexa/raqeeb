import { sql } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { canonicalGroup, itemBaseKind } from './enums';
import { tenants } from './tenancy';

/**
 * D3: tenant-scoped reusable workflow library. Unlimited named statuses,
 * each mapped to one of four canonical groups so reporting stays sane.
 * Custom statuses ship on EVERY plan tier (anti-Asana pledge).
 */
export const workflows = pgTable(
  'workflows',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('workflows_tenant_idx').on(t.tenantId)],
);

export const statuses = pgTable(
  'statuses',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => workflows.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull().default('#6b7280'),
    canonicalGroup: canonicalGroup('canonical_group').notNull(),
    position: text('position').notNull(), // fractional-indexing key (D10)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('statuses_tenant_workflow_idx').on(t.tenantId, t.workflowId)],
);

/**
 * D5: item types table ships now (system kinds seeded per tenant);
 * Wrike-style Custom Item Type features arrive in v2 on the same mechanism.
 */
export const itemTypes = pgTable(
  'item_types',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    icon: text('icon'),
    baseKind: itemBaseKind('base_kind').notNull().default('task'),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('item_types_tenant_idx').on(t.tenantId)],
);
