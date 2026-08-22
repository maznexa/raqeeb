import { ForbiddenException, Injectable } from '@nestjs/common';
import { schema, systemDb } from '@raqeeb/db';
import { eq } from 'drizzle-orm';

/**
 * Single enforcement point for plan feature gates (per plan 06-saas-commercial).
 * Scaffold: boolean feature flags from plans.features with a 60s in-process cache.
 * Later: per-tenant overrides, limit/metered kinds with consume() → ok | degraded.
 */
@Injectable()
export class EntitlementsService {
  private cache = new Map<string, { features: Record<string, boolean>; at: number }>();
  private static TTL_MS = 60_000;

  async features(tenantId: string): Promise<Record<string, boolean>> {
    const hit = this.cache.get(tenantId);
    if (hit && Date.now() - hit.at < EntitlementsService.TTL_MS) return hit.features;

    const row = await systemDb()
      .select({ features: schema.plans.features })
      .from(schema.tenants)
      .innerJoin(schema.plans, eq(schema.tenants.planId, schema.plans.id))
      .where(eq(schema.tenants.id, tenantId))
      .limit(1);
    const features = (row[0]?.features ?? {}) as Record<string, boolean>;
    this.cache.set(tenantId, { features, at: Date.now() });
    return features;
  }

  async check(tenantId: string, feature: string): Promise<boolean> {
    const features = await this.features(tenantId);
    return features[feature] === true;
  }

  async require(tenantId: string, feature: string): Promise<void> {
    if (!(await this.check(tenantId, feature))) {
      throw new ForbiddenException({
        title: 'Plan upgrade required',
        detail: `The "${feature}" feature is not included in this workspace's plan.`,
        feature,
      });
    }
  }
}
