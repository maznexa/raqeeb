import { drizzle } from 'drizzle-orm/node-postgres';
import { getAppPool, type Db } from './client';
import * as schema from './schema';

/**
 * The ONLY sanctioned path to tenant data.
 *
 * Opens a transaction on the RLS-bound app pool, sets the tenant context with
 * set_config(..., is_local = true) — the SET LOCAL equivalent, valid exactly for
 * this transaction — and hands a Drizzle instance bound to that same connection.
 *
 * RLS policies filter on NULLIF(current_setting('app.current_tenant_id', true), '')::uuid,
 * so a query outside withTenant() sees ZERO rows rather than another tenant's data.
 */
export async function withTenant<T>(tenantId: string, fn: (db: Db) => Promise<T>): Promise<T> {
  if (!tenantId) throw new Error('withTenant: tenantId is required');
  const client = await getAppPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
    const db = drizzle(client, { schema });
    const result = await fn(db);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // connection already broken; release below
    }
    throw err;
  } finally {
    client.release();
  }
}
