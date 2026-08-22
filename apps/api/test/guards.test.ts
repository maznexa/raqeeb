import { HttpException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { RateLimitGuard } from '../src/core/rate-limit.guard';
import { ReadOnlyGuard } from '../src/core/read-only.guard';
import type { TenantState, TenantStateService } from '../src/core/tenant-state.service';

/**
 * Guard tests against REAL Redis (REDIS_URL, default localhost:6379).
 * TenantStateService is stubbed — plan/status resolution is a one-row lookup;
 * what's under test here is window counting, header math, and the read-only gate.
 */

process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.DATABASE_URL ??= 'postgres://raqeeb_app:raqeeb_app@localhost:5432/raqeeb';
process.env.DATABASE_URL_SYSTEM ??= 'postgres://raqeeb_system:raqeeb_system@localhost:5432/raqeeb';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';

type HeaderBag = Record<string, string>;

function stateStub(byTenant: Record<string, TenantState>): TenantStateService {
  return {
    get: async (tenantId: string) => byTenant[tenantId],
    invalidate: () => undefined,
  } as unknown as TenantStateService;
}

const reflectorStub = (isPublic = false) =>
  ({ getAllAndOverride: () => isPublic }) as unknown as Reflector;

function httpCtx(opts: {
  method?: string;
  path?: string;
  principal?: unknown;
  tenantContext?: unknown;
}): { ctx: ExecutionContext; headers: HeaderBag } {
  const headers: HeaderBag = {};
  const req = {
    method: opts.method ?? 'GET',
    path: opts.path ?? '/api/v1/tasks',
    principal: opts.principal,
    tenantContext: opts.tenantContext,
  };
  const res = {
    setHeader: (name: string, value: string) => {
      headers[name.toLowerCase()] = String(value);
    },
  };
  const ctx = {
    getHandler: () => function handler() {},
    getClass: () => class Dummy {},
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ExecutionContext;
  return { ctx, headers };
}

const principal = { kind: 'user', accountId: randomUUID() };
const tenantCtx = (tenantId: string) => ({ tenantId, membershipId: randomUUID(), role: 'admin' });
const active = (planId: string): TenantState => ({ planId, subscriptionStatus: 'active' });

describe('RateLimitGuard', () => {
  const redis = new Redis(process.env.REDIS_URL!);
  // 15s into a minute → deterministic reset math (45s left in the window).
  const NOW = Date.UTC(2026, 7, 22, 12, 0, 15);
  const epochMinute = Math.floor(NOW / 60_000);

  const makeGuard = (states: Record<string, TenantState>, isPublic = false): RateLimitGuard => {
    const guard = new RateLimitGuard(reflectorStub(isPublic), stateStub(states));
    guard['redis'] = redis; // share one connection across tests
    return guard;
  };

  beforeAll(() => {
    // Only Date — ioredis needs real timers for its sockets.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterAll(async () => {
    vi.useRealTimers();
    await redis.quit();
  });

  it('counts a fixed window per tenant and reports the header math', async () => {
    const tenantId = randomUUID();
    const guard = makeGuard({ [tenantId]: active('free') });

    const first = httpCtx({ principal, tenantContext: tenantCtx(tenantId) });
    await expect(guard.canActivate(first.ctx)).resolves.toBe(true);
    expect(first.headers['ratelimit-limit']).toBe('60');
    expect(first.headers['ratelimit-remaining']).toBe('59');
    expect(first.headers['ratelimit-reset']).toBe('45');

    const second = httpCtx({ principal, tenantContext: tenantCtx(tenantId) });
    await expect(guard.canActivate(second.ctx)).resolves.toBe(true);
    expect(second.headers['ratelimit-remaining']).toBe('58');

    expect(await redis.get(`raqeeb:rl:${tenantId}:${epochMinute}`)).toBe('2');
    expect(await redis.ttl(`raqeeb:rl:${tenantId}:${epochMinute}`)).toBeGreaterThan(0);
  });

  it('applies the plan tier to the limit', async () => {
    const tenantId = randomUUID();
    const guard = makeGuard({ [tenantId]: active('pro') });
    const { ctx, headers } = httpCtx({ principal, tenantContext: tenantCtx(tenantId) });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(headers['ratelimit-limit']).toBe('300');
    expect(headers['ratelimit-remaining']).toBe('299');
  });

  it('returns 429 problem details with Retry-After once the window is spent', async () => {
    const tenantId = randomUUID();
    const guard = makeGuard({ [tenantId]: active('free') });
    await redis.set(`raqeeb:rl:${tenantId}:${epochMinute}`, '59', 'EX', 120);

    const atLimit = httpCtx({ method: 'POST', principal, tenantContext: tenantCtx(tenantId) });
    await expect(guard.canActivate(atLimit.ctx)).resolves.toBe(true); // request #60 still passes
    expect(atLimit.headers['ratelimit-remaining']).toBe('0');

    const over = httpCtx({ method: 'POST', principal, tenantContext: tenantCtx(tenantId) });
    const err: HttpException = await guard.canActivate(over.ctx).then(
      () => {
        throw new Error('expected 429');
      },
      (e: HttpException) => e,
    );
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(429);
    const body = err.getResponse() as Record<string, unknown>;
    expect(body.title).toBe('Rate limit exceeded');
    expect(body.scope).toBe('tenant');
    expect(body.limit).toBe(60);
    expect(body.retry_after).toBe(45);
    expect(over.headers['ratelimit-remaining']).toBe('0');
    expect(over.headers['retry-after']).toBe('45');
  });

  it('meters tenant-less sessions per account at the baseline limit', async () => {
    const accountId = randomUUID();
    const guard = makeGuard({});
    const { ctx, headers } = httpCtx({ principal: { kind: 'user', accountId } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(headers['ratelimit-limit']).toBe('60');
    expect(await redis.get(`raqeeb:rl:account:${accountId}:${epochMinute}`)).toBe('1');
  });

  it('skips public routes, unauthenticated requests, and /healthz', async () => {
    const pub = httpCtx({ principal, tenantContext: tenantCtx(randomUUID()) });
    await expect(makeGuard({}, true).canActivate(pub.ctx)).resolves.toBe(true);
    expect(pub.headers).toEqual({});

    const anon = httpCtx({});
    await expect(makeGuard({}).canActivate(anon.ctx)).resolves.toBe(true);
    expect(anon.headers).toEqual({});

    const health = httpCtx({ path: '/api/v1/healthz', principal });
    await expect(makeGuard({}).canActivate(health.ctx)).resolves.toBe(true);
    expect(health.headers).toEqual({});
  });

  it('fails open with headers when Redis is down', async () => {
    const tenantId = randomUUID();
    const guard = new RateLimitGuard(reflectorStub(), stateStub({ [tenantId]: active('free') }));
    const dead = new Redis('redis://127.0.0.1:6399', {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    dead.on('error', () => undefined);
    guard['redis'] = dead;

    const { ctx, headers } = httpCtx({ principal, tenantContext: tenantCtx(tenantId) });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(headers['ratelimit-limit']).toBe('60');
    expect(headers['ratelimit-reset']).toBe('45');
    dead.disconnect();
  });
});

describe('ReadOnlyGuard', () => {
  const pastDueTenant = randomUUID();
  const activeTenant = randomUUID();
  const guard = new ReadOnlyGuard(
    stateStub({
      [pastDueTenant]: { planId: 'pro', subscriptionStatus: 'past_due' },
      [activeTenant]: active('pro'),
    }),
  );

  it('blocks writes for a past_due tenant with a 403 problem body', async () => {
    const { ctx } = httpCtx({
      method: 'POST',
      path: '/api/v1/tasks',
      principal,
      tenantContext: tenantCtx(pastDueTenant),
    });
    const err: HttpException = await guard.canActivate(ctx).then(
      () => {
        throw new Error('expected 403');
      },
      (e: HttpException) => e,
    );
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(403);
    const body = err.getResponse() as Record<string, string>;
    expect(body.title).toBe('Workspace is read-only');
    expect(body.detail).toMatch(/billing|subscription|payment/i);
  });

  it('always allows reads — data is never hostage', async () => {
    const { ctx } = httpCtx({
      method: 'GET',
      path: '/api/v1/tasks',
      principal,
      tenantContext: tenantCtx(pastDueTenant),
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('allows billing and auth writes so the customer can recover', async () => {
    for (const path of ['/api/v1/billing/checkout', '/api/v1/auth/refresh']) {
      const { ctx } = httpCtx({
        method: 'POST',
        path,
        principal,
        tenantContext: tenantCtx(pastDueTenant),
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    }
  });

  it('lets active tenants and tenant-less requests write normally', async () => {
    const ok = httpCtx({
      method: 'POST',
      path: '/api/v1/tasks',
      principal,
      tenantContext: tenantCtx(activeTenant),
    });
    await expect(guard.canActivate(ok.ctx)).resolves.toBe(true);

    const noTenant = httpCtx({ method: 'POST', path: '/api/v1/tenants', principal });
    await expect(guard.canActivate(noTenant.ctx)).resolves.toBe(true);
  });
});
