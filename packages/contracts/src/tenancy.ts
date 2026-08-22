import { z } from 'zod';
import { localeSchema, membershipRoleSchema, uuid } from './common';

export const slugSchema = z
  .string()
  .min(3)
  .max(48)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'lowercase letters, digits, hyphens');

export const createTenantSchema = z.object({
  name: z.string().min(2).max(120),
  slug: slugSchema.optional(), // derived from name when omitted
  defaultLocale: localeSchema.default('en'),
});
export type CreateTenantInput = z.infer<typeof createTenantSchema>;

export const tenantDtoSchema = z.object({
  id: uuid,
  name: z.string(),
  slug: z.string(),
  planId: z.string(),
  subscriptionStatus: z.string(),
  defaultLocale: localeSchema,
});
export type TenantDto = z.infer<typeof tenantDtoSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: membershipRoleSchema.default('member'),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const memberDtoSchema = z.object({
  membershipId: uuid,
  accountId: uuid,
  email: z.string().email(),
  displayName: z.string(),
  role: membershipRoleSchema,
  isBillableSeat: z.boolean(),
});
export type MemberDto = z.infer<typeof memberDtoSchema>;
