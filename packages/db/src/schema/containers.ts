import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { projectState } from './enums';
import { tenants } from './tenancy';
import { workflows } from './workflows';

/**
 * D1: Tenant → Space → Folder* (optional, nestable ≤5) → Project → Section → Task.
 * Space = permission/feature boundary; Project = the terminal task container
 * (≡ ClickUp List / Teamwork Task List / Asana Project / monday Board).
 */
export const spaces = pgTable(
  'spaces',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    icon: text('icon'),
    isPrivate: boolean('is_private').notNull().default(false),
    position: text('position').notNull(), // fractional key (D10)
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('spaces_tenant_idx').on(t.tenantId)],
);

export const folders = pgTable(
  'folders',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    parentFolderId: uuid('parent_folder_id').references((): AnyPgColumn => folders.id, {
      onDelete: 'cascade',
    }),
    name: text('name').notNull(),
    // Depth is enforced in the service layer (≤5) and denormalized here for cheap checks.
    depth: smallint('depth').notNull().default(1),
    position: text('position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('folders_tenant_space_idx').on(t.tenantId, t.spaceId)],
);

export const clients = pgTable(
  'clients',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    currency: text('currency').notNull().default('USD'), // ISO 4217; locked per client (Teamwork model)
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('clients_tenant_idx').on(t.tenantId)],
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    folderId: uuid('folder_id').references(() => folders.id, { onDelete: 'set null' }),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => workflows.id),
    name: text('name').notNull(),
    // Human task-ID prefix, e.g. RAQ → RAQ-123 (ClickUp Custom Task IDs).
    key: text('key').notNull(),
    color: text('color'),
    state: projectState('state').notNull().default('active'),
    position: text('position').notNull(),
    startDate: date('start_date'),
    dueDate: date('due_date'),
    // Monotonic per-project counter for task numbers (assigned from the PRIMARY location).
    nextTaskNumber: integer('next_task_number').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('projects_tenant_key_uq').on(t.tenantId, t.key),
    index('projects_tenant_space_idx').on(t.tenantId, t.spaceId),
    index('projects_tenant_client_idx').on(t.tenantId, t.clientId),
  ],
);

export const sections = pgTable(
  'sections',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: text('position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sections_tenant_project_idx').on(t.tenantId, t.projectId)],
);
