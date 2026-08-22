import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import Redis from 'ioredis';
import { IS_PUBLIC_KEY, type Principal, type TenantContext } from '../auth/decorators';
import { env } from './env';
import { TenantStateService } from './tenant-state.service';

/** Plan-tiered sustained req/min (docs/05-api-design/05-versioning-rate-limits.md). */
const PLAN_LIMITS: Record<string, number> = {
  free: 60,
  pro: 300,
  business: 1_000,
  enterprise: 5_000,
};
/** Authenticated calls without a tenant header ("my tenants" etc.): Free baseline. */
const DEFAULT_LIMIT = 60;
const WINDOW_MS = 60_000;

/**
 * Fixed-window per-tenant rate limiter. Global guard, MUST be registered after
 * AuthGuard — it reads req.principal / req.tenantContext set there.
 *
 * Counter lives in Redis under raqeeb:rl:{tenantId|account:{id}}:{epochMinute};
 * the key name rotates every minute and expires shortly after, so there is no
 * cleanup job and no cross-window bleed.
 *
 * DECISION (documented): if Redis is unreachable the guard FAILS OPEN with a
 * logged warning — availability over enforcement. A Redis outage must degrade
 * to "unmetered" rather than take the whole API down with it.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private redis?: Redis;

  constructor(
    private readonly reflector: Reflector,
    private readonly tenantState: TenantStateService,
  ) {}

  private client(): Redis {
    if (!this.redis) {
      this.redis = new Redis(env().REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 2_000 });
      // Connection errors surface per-request as fail-open; keep the emitter quiet.
      this.redis.on('error', () => undefined);
    }
    return this.redis;
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const http = ctx.switchToHttp();
    const req = http.getRequest<
      Request & { principal?: Principal; tenantContext?: TenantContext }
    >();
    const res = http.getResponse<Response>();

    if ((req.path ?? '').endsWith('/healthz')) return true;
    const principal = req.principal;
    if (!principal) return true; // unauthenticated — AuthGuard already decided

    const tenant = req.tenantContext;
    let scope: 'tenant' | 'account';
    let bucket: string;
    let limit = DEFAULT_LIMIT;
    if (tenant) {
      scope = 'tenant';
      bucket = tenant.tenantId;
      const state = await this.tenantState.get(tenant.tenantId);
      limit = PLAN_LIMITS[state?.planId ?? ''] ?? DEFAULT_LIMIT;
    } else {
      scope = 'account';
      bucket = `account:${principal.kind === 'user' ? principal.accountId : principal.patId}`;
    }

    const now = Date.now();
    const epochMinute = Math.floor(now / WINDOW_MS);
    const resetSeconds = Math.max(1, Math.ceil(((epochMinute + 1) * WINDOW_MS - now) / 1000));
    const key = `raqeeb:rl:${bucket}:${epochMinute}`;

    let count: number;
    try {
      const results = await this.client()
        .multi()
        .incr(key)
        .expire(key, 120) // outlives the window; the key name rotates per minute
        .exec();
      const [err, value] = results?.[0] ?? [new Error('rate-limit pipeline aborted'), undefined];
      if (err) throw err;
      count = Number(value);
    } catch (error) {
      this.logger.warn(
        `Redis unavailable for rate limiting, failing open: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      this.setHeaders(res, limit, limit, resetSeconds); // count unknown — report a full window
      return true;
    }

    this.setHeaders(res, limit, Math.max(0, limit - count), resetSeconds);

    if (count > limit) {
      res.setHeader('Retry-After', String(resetSeconds));
      throw new HttpException(
        {
          title: 'Rate limit exceeded',
          detail: `Limit of ${limit} requests per minute exceeded for this ${scope}; retry in ${resetSeconds}s.`,
          scope,
          limit,
          retry_after: resetSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  /** Draft IETF RateLimit headers on every authenticated response, 429 or not. */
  private setHeaders(res: Response, limit: number, remaining: number, resetSeconds: number): void {
    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(resetSeconds));
  }
}
