import { z } from 'zod';

export const uuid = z.string().uuid();

export const localeSchema = z.enum(['en', 'ar']);
export type Locale = z.infer<typeof localeSchema>;

export const canonicalGroupSchema = z.enum(['not_started', 'active', 'done', 'cancelled']);
export type CanonicalGroup = z.infer<typeof canonicalGroupSchema>;

export const itemBaseKindSchema = z.enum(['task', 'milestone', 'approval']);
export type ItemBaseKind = z.infer<typeof itemBaseKindSchema>;

export const taskPrioritySchema = z.enum(['urgent', 'high', 'normal', 'low']);
export type TaskPriority = z.infer<typeof taskPrioritySchema>;

export const approvalStatusSchema = z.enum([
  'pending',
  'approved',
  'changes_requested',
  'rejected',
]);
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;

export const membershipRoleSchema = z.enum(['owner', 'admin', 'member', 'guest', 'client']);
export type MembershipRole = z.infer<typeof membershipRoleSchema>;

export const dependencyTypeSchema = z.enum([
  'finish_to_start',
  'start_to_start',
  'finish_to_finish',
  'start_to_finish',
]);
export type DependencyType = z.infer<typeof dependencyTypeSchema>;

/** ISO date (YYYY-MM-DD) — tasks carry date-only scheduling in v1. */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

/** Cursor pagination query — the API never exposes raw fractional keys (D10). */
export const paginationQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
