import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { schema, systemDb } from '@raqeeb/db';
import { and, eq, isNull } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { env } from '../core/env';
import { IS_PUBLIC_KEY, type Principal, type TenantContext } from './decorators';

/**
 * Global guard implementing the request lifecycle from the plan:
 *   Bearer token (JWT session or raq_pat_*) → principal
 *   → tenant header (X-Tenant-Id / X-Tenant-Slug) → membership check → tenantContext.
 * RLS is engaged later by services via withTenant(tenantContext.tenantId).
 *
 * Membership/PAT lookups intentionally run on the SYSTEM pool: they are the
 * cross-tenant identity resolution step that happens BEFORE a tenant context exists.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request & Record<string, unknown>>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = header.slice('Bearer '.length).trim();

    if (token.startsWith('raq_pat_')) {
      const principal = await this.resolvePat(token);
      req.principal = principal;
      req.tenantContext = await this.contextForMembership(principal.membershipId);
      return true;
    }

    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync(token, { secret: env().JWT_ACCESS_SECRET });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    const principal: Principal = { kind: 'user', accountId: payload.sub };
    req.principal = principal;
    req.tenantContext = await this.resolveTenantHeader(req, payload.sub);
    return true;
  }

  private async resolvePat(token: string): Promise<Extract<Principal, { kind: 'pat' }>> {
    const hash = createHash('sha256').update(token).digest('hex');
    const db = systemDb();
    const pat = await db.query.personalAccessTokens.findFirst({
      where: and(
        eq(schema.personalAccessTokens.tokenHash, hash),
        isNull(schema.personalAccessTokens.revokedAt),
      ),
    });
    if (!pat) throw new UnauthorizedException('Invalid token');
    if (pat.expiresAt && pat.expiresAt < new Date()) {
      throw new UnauthorizedException('Token expired');
    }
    // last-used tracking, best effort
    void db
      .update(schema.personalAccessTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(schema.personalAccessTokens.id, pat.id))
      .catch(() => undefined);
    return { kind: 'pat', patId: pat.id, tenantId: pat.tenantId, membershipId: pat.membershipId };
  }

  private async contextForMembership(membershipId: string): Promise<TenantContext> {
    const m = await systemDb().query.memberships.findFirst({
      where: eq(schema.memberships.id, membershipId),
    });
    if (!m || m.status !== 'active') throw new UnauthorizedException('Membership inactive');
    return { tenantId: m.tenantId, membershipId: m.id, role: m.role };
  }

  private async resolveTenantHeader(
    req: Request,
    accountId: string,
  ): Promise<TenantContext | undefined> {
    const tenantId = req.headers['x-tenant-id'] as string | undefined;
    const tenantSlug = req.headers['x-tenant-slug'] as string | undefined;
    if (!tenantId && !tenantSlug) return undefined;

    const db = systemDb();
    let resolvedId = tenantId;
    if (!resolvedId && tenantSlug) {
      const t = await db.query.tenants.findFirst({ where: eq(schema.tenants.slug, tenantSlug) });
      if (!t) throw new UnauthorizedException('Unknown tenant');
      resolvedId = t.id;
    }
    const m = await db.query.memberships.findFirst({
      where: and(
        eq(schema.memberships.tenantId, resolvedId!),
        eq(schema.memberships.accountId, accountId),
      ),
    });
    if (!m || m.status !== 'active') {
      throw new UnauthorizedException('Not a member of this tenant');
    }
    return { tenantId: m.tenantId, membershipId: m.id, role: m.role };
  }
}
