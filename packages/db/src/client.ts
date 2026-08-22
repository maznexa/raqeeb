import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;

/**
 * Two runtime pools, two privilege levels:
 *
 * - APP pool (`DATABASE_URL`, role raqeeb_app): subject to FORCE ROW LEVEL SECURITY.
 *   Every tenant-scoped query MUST go through withTenant() (tenant-context.ts).
 *
 * - SYSTEM pool (`DATABASE_URL_SYSTEM`, role raqeeb_system, BYPASSRLS): the documented
 *   escape hatch for cross-tenant operations ONLY — signup/login (global accounts),
 *   "my tenants" listing, tenant provisioning, invitation acceptance, PAT lookup,
 *   billing reconciliation. Never use it for tenant-scoped business reads/writes.
 */
let appPool: pg.Pool | undefined;
let systemPool: pg.Pool | undefined;

export function getAppPool(): pg.Pool {
  if (!appPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    appPool = new pg.Pool({ connectionString: url, max: 10 });
  }
  return appPool;
}

export function getSystemPool(): pg.Pool {
  if (!systemPool) {
    const url = process.env.DATABASE_URL_SYSTEM;
    if (!url) throw new Error('DATABASE_URL_SYSTEM is not set');
    systemPool = new pg.Pool({ connectionString: url, max: 5 });
  }
  return systemPool;
}

let systemDbInstance: Db | undefined;

/** Drizzle over the SYSTEM pool — cross-tenant/global tables only (see above). */
export function systemDb(): Db {
  if (!systemDbInstance) {
    systemDbInstance = drizzle(getSystemPool(), { schema });
  }
  return systemDbInstance;
}

export async function closePools(): Promise<void> {
  await Promise.all([appPool?.end(), systemPool?.end()]);
  appPool = undefined;
  systemPool = undefined;
  systemDbInstance = undefined;
}

export { schema };
