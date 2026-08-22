import type { Job, Processor } from 'bullmq';
import { withTenant, type Db } from '@raqeeb/db';

/**
 * THE worker-side RLS rule (docs/04-architecture/02-tenancy-rls.md):
 * every job payload carries tenant_id, and processors re-enter withTenant()
 * before touching tenant data. Extend this base instead of writing raw processors —
 * it is the guard rail against the classic background-job tenancy leak.
 */
export interface TenantJobData {
  tenantId: string;
  [key: string]: unknown;
}

export function tenantProcessor<T extends TenantJobData>(
  handler: (db: Db, job: Job<T>) => Promise<void>,
): Processor<T> {
  return async (job) => {
    const { tenantId } = job.data;
    if (!tenantId) {
      throw new Error(`Job ${job.name}#${job.id} has no tenantId — refusing to run`);
    }
    await withTenant(tenantId, (db) => handler(db, job));
  };
}
