import { z } from 'zod';
import { localeSchema, membershipRoleSchema, uuid } from './common';

export const signupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(120),
  locale: localeSchema.default('en'),
  // Optional: create a tenant in the same step (self-serve signup flow)
  tenantName: z.string().min(2).max(120).optional(),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const accountDtoSchema = z.object({
  id: uuid,
  email: z.string().email(),
  displayName: z.string(),
  locale: localeSchema,
  timezone: z.string(),
});
export type AccountDto = z.infer<typeof accountDtoSchema>;

export const myTenantDtoSchema = z.object({
  tenantId: uuid,
  name: z.string(),
  slug: z.string(),
  role: membershipRoleSchema,
  membershipId: uuid,
  defaultLocale: localeSchema,
});
export type MyTenantDto = z.infer<typeof myTenantDtoSchema>;

export const createPatSchema = z.object({
  name: z.string().min(1).max(120),
  expiresAt: z.string().datetime().optional(),
});
export type CreatePatInput = z.infer<typeof createPatSchema>;
