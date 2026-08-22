import { z } from 'zod';
import {
  approvalStatusSchema,
  canonicalGroupSchema,
  dependencyTypeSchema,
  isoDate,
  itemBaseKindSchema,
  taskPrioritySchema,
  uuid,
} from './common';

// ---- containers -------------------------------------------------------------

export const createSpaceSchema = z.object({
  name: z.string().min(1).max(120),
  icon: z.string().max(64).optional(),
  isPrivate: z.boolean().default(false),
});
export type CreateSpaceInput = z.infer<typeof createSpaceSchema>;

export const createFolderSchema = z.object({
  spaceId: uuid,
  parentFolderId: uuid.optional(),
  name: z.string().min(1).max(120),
});
export type CreateFolderInput = z.infer<typeof createFolderSchema>;

export const createProjectSchema = z.object({
  spaceId: uuid,
  folderId: uuid.optional(),
  clientId: uuid.optional(),
  workflowId: uuid.optional(), // defaults to the tenant's default workflow
  name: z.string().min(1).max(200),
  key: z
    .string()
    .min(2)
    .max(10)
    .regex(/^[A-Z][A-Z0-9]*$/, 'uppercase letters/digits, starts with a letter')
    .optional(), // derived from name when omitted
  color: z.string().max(16).optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const createSectionSchema = z.object({
  name: z.string().min(1).max(120),
});
export type CreateSectionInput = z.infer<typeof createSectionSchema>;

// ---- workflows ----------------------------------------------------------------

export const statusInputSchema = z.object({
  name: z.string().min(1).max(60),
  color: z.string().max(16).default('#6b7280'),
  canonicalGroup: canonicalGroupSchema,
});

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(120),
  statuses: z.array(statusInputSchema).min(2),
});
export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;

// ---- tasks --------------------------------------------------------------------

export const createTaskSchema = z.object({
  projectId: uuid,
  sectionId: uuid.optional(),
  parentTaskId: uuid.optional(),
  itemKind: itemBaseKindSchema.default('task'),
  title: z.string().min(1).max(500),
  description: z.string().max(50_000).optional(),
  statusId: uuid.optional(), // defaults to first not_started status of the project workflow
  priority: taskPrioritySchema.default('normal'),
  estimateMinutes: z.number().int().positive().max(600_000).optional(),
  startDate: isoDate.optional(),
  dueDate: isoDate.optional(),
  assigneeMembershipIds: z.array(uuid).max(20).default([]),
  // Ordering: callers reference sibling task ids, never raw fractional keys (D10)
  insertBeforeTaskId: uuid.optional(),
  insertAfterTaskId: uuid.optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(50_000).nullable().optional(),
  statusId: uuid.optional(),
  approvalStatus: approvalStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  estimateMinutes: z.number().int().positive().max(600_000).nullable().optional(),
  startDate: isoDate.nullable().optional(),
  dueDate: isoDate.nullable().optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

/** Move/reorder a task within one of its locations (project). */
export const moveTaskSchema = z.object({
  projectId: uuid,
  sectionId: uuid.nullable().optional(),
  insertBeforeTaskId: uuid.optional(),
  insertAfterTaskId: uuid.optional(),
});
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;

/** D2 multi-homing: add the task to another project. */
export const addTaskLocationSchema = z.object({
  projectId: uuid,
  sectionId: uuid.optional(),
});
export type AddTaskLocationInput = z.infer<typeof addTaskLocationSchema>;

export const setAssigneesSchema = z.object({
  assigneeMembershipIds: z.array(uuid).max(20),
});
export type SetAssigneesInput = z.infer<typeof setAssigneesSchema>;

export const createDependencySchema = z.object({
  predecessorTaskId: uuid,
  successorTaskId: uuid,
  dependencyType: dependencyTypeSchema.default('finish_to_start'),
  lagDays: z.number().int().min(-365).max(365).default(0),
});
export type CreateDependencyInput = z.infer<typeof createDependencySchema>;

// ---- DTOs -----------------------------------------------------------------------

export const taskDtoSchema = z.object({
  id: uuid,
  humanId: z.string().nullable(), // e.g. WEB-12 (primary project key + number)
  title: z.string(),
  description: z.string().nullable(),
  itemKind: itemBaseKindSchema,
  status: z.object({
    id: uuid,
    name: z.string(),
    color: z.string(),
    canonicalGroup: canonicalGroupSchema,
  }),
  approvalStatus: approvalStatusSchema.nullable(),
  priority: taskPrioritySchema,
  estimateMinutes: z.number().nullable(),
  startDate: isoDate.nullable(),
  dueDate: isoDate.nullable(),
  parentTaskId: uuid.nullable(),
  completedAt: z.string().nullable(),
  assignees: z.array(
    z.object({ membershipId: uuid, displayName: z.string() }),
  ),
  locations: z.array(
    z.object({
      projectId: uuid,
      sectionId: uuid.nullable(),
      isPrimary: z.boolean(),
    }),
  ),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TaskDto = z.infer<typeof taskDtoSchema>;
