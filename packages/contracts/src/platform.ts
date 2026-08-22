import { z } from 'zod';
import { uuid } from './common';

// ---- comments ---------------------------------------------------------------

export const createCommentSchema = z.object({
  body: z.string().min(1).max(20_000),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = z.object({
  body: z.string().min(1).max(20_000),
});
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

export const commentDtoSchema = z.object({
  id: uuid,
  taskId: uuid,
  author: z.object({ membershipId: uuid, displayName: z.string() }),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  edited: z.boolean(),
});
export type CommentDto = z.infer<typeof commentDtoSchema>;

// ---- public webhooks -----------------------------------------------------------

/** Event filters: exact names ("task.created"), prefix wildcards ("task.*"), or "*". */
export const webhookEventFilter = z
  .string()
  .regex(/^(\*|[a-z_]+\.(\*|[a-z_]+))$/, 'e.g. "task.created", "task.*", or "*"');

export const createWebhookSchema = z.object({
  url: z.string().url().max(2000),
  events: z.array(webhookEventFilter).min(1).max(50).default(['*']),
});
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

export const webhookDtoSchema = z.object({
  id: uuid,
  url: z.string(),
  events: z.array(z.string()),
  status: z.enum(['active', 'suspended']),
  failureCount: z.number(),
  lastSuccessAt: z.string().nullable(),
  createdAt: z.string(),
});
export type WebhookDto = z.infer<typeof webhookDtoSchema>;

// ---- billing --------------------------------------------------------------------

export const startCheckoutSchema = z.object({
  planId: z.enum(['pro', 'business']),
  interval: z.enum(['month', 'year']).default('month'),
});
export type StartCheckoutInput = z.infer<typeof startCheckoutSchema>;

export const billingStatusDtoSchema = z.object({
  planId: z.string(),
  subscriptionStatus: z.enum(['trialing', 'active', 'past_due', 'canceled']),
  trialEndsAt: z.string().nullable(),
  billableSeats: z.number(),
  readOnly: z.boolean(), // past_due read-only mode (data never hostage)
});
export type BillingStatusDto = z.infer<typeof billingStatusDtoSchema>;
