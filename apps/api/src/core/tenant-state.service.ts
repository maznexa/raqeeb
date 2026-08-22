import { Injectable } from '@nestjs/common';
import { schema, systemDb } from '@raqeeb/db';
import { eq } from 'drizzle-orm';

export interface TenantState {
  planId: string;
  subscriptionStatus: 'trialing' | 'active' | 'past_due' | 'canceled';
}

/**
 * The two tenant fields the platform guards read on every request:
 * plan_id → rate tier, subscription_status → past_due read-only mode.
 *
 * SYSTEM pool by design: guards run before any tenant transaction exists, and
 * this is billing/identity resolution, not tenant business data (same category
 * as the AuthGuard membership lookup). 30s in-process cache keeps the hot path
 * off Postgres; staleness is bounded and acceptable for both consumers.
 */
@Injectable()
export class TenantStateService {
  private cache = new Map<string, { state: TenantState; at: number }>();
  private static TTL_MS = 30_000;
  /** Bound the per-process map (insertion-ordered eviction) — a long-lived API
   *  process serving many tenants must not grow this monotonically. */
  private static MAX_ENTRIES = 10_000;

  async get(tenantId: string): Promise<TenantState | undefined> {
    const hit = this.cache.get(tenantId);
    if (hit && Date.now() - hit.at < TenantStateService.TTL_MS) return hit.state;
    if (hit) this.cache.delete(tenantId); // expired — drop instead of letting it linger

    const row = await systemDb().query.tenants.findFirst({
      where: eq(schema.tenants.id, tenantId),
      columns: { planId: true, subscriptionStatus: true },
    });
    if (!row) return undefined;

    const state: TenantState = {
      planId: row.planId,
      subscriptionStatus: row.subscriptionStatus,
    };
    if (this.cache.size >= TenantStateService.MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(tenantId, { state, at: Date.now() });
    return state;
  }

  /** For billing webhook handlers (and tests): make the next read hit the database. */
  invalidate(tenantId: string): void {
    this.cache.delete(tenantId);
  }
}
