import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tasks } from './tasks';
import { memberships, tenants } from './tenancy';

/**
 * Collaboration slice (Wave B, first tranche): comments on tasks.
 * No edit-window nonsense (anti-Wrike pledge) — edits allowed, tracked via updatedAt;
 * soft delete keeps the activity stream honest.
 */
export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    authorMembershipId: uuid('author_membership_id')
      .notNull()
      .references(() => memberships.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('comments_tenant_task_idx').on(t.tenantId, t.taskId, t.createdAt)],
);
