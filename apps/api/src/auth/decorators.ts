import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
  BadRequestException,
} from '@nestjs/common';
import type { MembershipRole } from '@raqeeb/contracts';

export const IS_PUBLIC_KEY = 'isPublic';
/** Route needs no authentication (signup, login, health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export type Principal =
  | { kind: 'user'; accountId: string }
  | { kind: 'pat'; patId: string; tenantId: string; membershipId: string };

export interface TenantContext {
  tenantId: string;
  membershipId: string;
  role: MembershipRole;
}

/** The authenticated principal (user session or PAT). */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Principal => {
    return ctx.switchToHttp().getRequest().principal;
  },
);

/**
 * The resolved tenant context. Requires the X-Tenant-Id or X-Tenant-Slug header
 * on user-session calls; PATs are tenant-bound already.
 */
export const Tenant = createParamDecorator((_data: unknown, ctx: ExecutionContext): TenantContext => {
  const tenant = ctx.switchToHttp().getRequest().tenantContext;
  if (!tenant) {
    throw new BadRequestException(
      'Tenant context required: pass X-Tenant-Id or X-Tenant-Slug, or authenticate with a PAT',
    );
  }
  return tenant;
});
