import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sections, projects } from './containers';
import { approvalStatus, dependencyType, taskPriority } from './enums';
import { memberships, tenants } from './tenancy';
import { itemTypes, statuses } from './workflows';

/**
 * D2: one canonical task, homed in N projects via task_locations.
 * D6: milestone/approval subtypes via item_types + approval_status.
 * D7: estimate (effort) and start/due dates (duration window) are independent;
 *     assignment is task_assignees; allocations (capacity) arrive in Wave B.
 */
export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    itemTypeId: uuid('item_type_id')
      .notNull()
      .references(() => itemTypes.id),
    parentTaskId: uuid('parent_task_id').references((): AnyPgColumn => tasks.id, {
      onDelete: 'cascade',
    }),
    title: text('title').notNull(),
    description: text('description'),
    statusId: uuid('status_id')
      .notNull()
      .references(() => statuses.id),
    approvalStatus: approvalStatus('approval_status'), // only for approval-kind items
    priority: taskPriority('priority').notNull().default('normal'),
    estimateMinutes: integer('estimate_minutes'),
    startDate: date('start_date'),
    dueDate: date('due_date'),
    // Human ID: <project.key>-<task_number>, from the PRIMARY location's project counter.
    taskNumber: integer('task_number'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdByMembershipId: uuid('created_by_membership_id').references(() => memberships.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('tasks_tenant_idx').on(t.tenantId),
    index('tasks_tenant_status_idx').on(t.tenantId, t.statusId),
    index('tasks_tenant_parent_idx').on(t.tenantId, t.parentTaskId),
    index('tasks_tenant_due_idx').on(t.tenantId, t.dueDate),
  ],
);

export const taskLocations = pgTable(
  'task_locations',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    sectionId: uuid('section_id').references(() => sections.id, { onDelete: 'set null' }),
    position: text('position').notNull(), // fractional key (D10) — ordering within the project
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('task_locations_task_project_uq').on(t.taskId, t.projectId),
    // Exactly one primary home per task — partial unique index appended in migration SQL.
    index('task_locations_tenant_project_idx').on(t.tenantId, t.projectId),
    index('task_locations_tenant_task_idx').on(t.tenantId, t.taskId),
  ],
);

export const taskAssignees = pgTable(
  'task_assignees',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => memberships.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.taskId, t.membershipId] }),
    index('task_assignees_tenant_membership_idx').on(t.tenantId, t.membershipId),
  ],
);

export const taskDependencies = pgTable(
  'task_dependencies',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    predecessorId: uuid('predecessor_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    successorId: uuid('successor_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    dependencyType: dependencyType('dependency_type').notNull().default('finish_to_start'),
    lagDays: integer('lag_days').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('task_dependencies_pair_uq').on(t.predecessorId, t.successorId),
    index('task_dependencies_tenant_succ_idx').on(t.tenantId, t.successorId),
    check('task_dependencies_no_self', sql`${t.predecessorId} <> ${t.successorId}`),
  ],
);
