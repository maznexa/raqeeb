import { pgEnum } from 'drizzle-orm/pg-core';

export const membershipRole = pgEnum('membership_role', [
  'owner',
  'admin',
  'member',
  'guest',
  'client',
]);

export const subscriptionStatus = pgEnum('subscription_status', [
  'trialing',
  'active',
  'past_due',
  'canceled',
]);

// D3: unlimited named statuses, exactly four canonical groups (Wrike/ClickUp hybrid).
export const canonicalGroup = pgEnum('canonical_group', [
  'not_started',
  'active',
  'done',
  'cancelled',
]);

// D5/D6: item types built on three system base kinds.
export const itemBaseKind = pgEnum('item_base_kind', ['task', 'milestone', 'approval']);

export const approvalStatus = pgEnum('approval_status', [
  'pending',
  'approved',
  'changes_requested',
  'rejected',
]);

export const taskPriority = pgEnum('task_priority', ['urgent', 'high', 'normal', 'low']);

// Four classic dependency types + lag (Wrike/blueprint-2 model).
export const dependencyType = pgEnum('dependency_type', [
  'finish_to_start',
  'start_to_start',
  'finish_to_finish',
  'start_to_finish',
]);

export const projectState = pgEnum('project_state', ['active', 'completed', 'archived']);
