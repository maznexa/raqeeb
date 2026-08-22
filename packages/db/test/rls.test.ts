import { sql } from 'drizzle-orm';
import { generateKeyBetween } from 'fractional-indexing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePools, getAppPool, systemDb } from '../src/client';
import * as schema from '../src/schema';
import { withTenant } from '../src/tenant-context';

/**
 * THE tenancy security suite (non-negotiable, per plan):
 * proves that the RLS boundary holds for reads, writes, and missing context.
 *
 * Requires a migrated database (CI runs `pnpm db:migrate` first; locally:
 * `docker compose up -d && pnpm db:migrate`).
 */

type Fixture = { tenantId: string; taskId: string };

async function provisionMinimalTenant(slug: string, title: string): Promise<Fixture> {
  const db = systemDb();
  const [tenant] = await db
    .insert(schema.tenants)
    .values({ name: slug, slug, planId: 'free' })
    .returning();
  const [wf] = await db
    .insert(schema.workflows)
    .values({ tenantId: tenant!.id, name: 'Default', isDefault: true })
    .returning();
  const [status] = await db
    .insert(schema.statuses)
    .values({
      tenantId: tenant!.id,
      workflowId: wf!.id,
      name: 'Open',
      canonicalGroup: 'active',
      position: generateKeyBetween(null, null),
    })
    .returning();
  const [itemType] = await db
    .insert(schema.itemTypes)
    .values({ tenantId: tenant!.id, name: 'Task', baseKind: 'task', isSystem: true })
    .returning();
  const [space] = await db
    .insert(schema.spaces)
    .values({ tenantId: tenant!.id, name: 'Space', position: generateKeyBetween(null, null) })
    .returning();
  const [project] = await db
    .insert(schema.projects)
    .values({
      tenantId: tenant!.id,
      spaceId: space!.id,
      workflowId: wf!.id,
      name: 'Project',
      key: `K${slug.slice(-6).toUpperCase().replace(/[^A-Z0-9]/g, 'X')}`,
      position: generateKeyBetween(null, null),
    })
    .returning();
  const [task] = await db
    .insert(schema.tasks)
    .values({
      tenantId: tenant!.id,
      itemTypeId: itemType!.id,
      title,
      statusId: status!.id,
      taskNumber: 1,
    })
    .returning();
  await db.insert(schema.taskLocations).values({
    tenantId: tenant!.id,
    taskId: task!.id,
    projectId: project!.id,
    position: generateKeyBetween(null, null),
    isPrimary: true,
  });
  return { tenantId: tenant!.id, taskId: task!.id };
}

const STAMP = Date.now().toString(36);
let a: Fixture;
let b: Fixture;

beforeAll(async () => {
  // Plans row needed for tenants FK; idempotent.
  await systemDb()
    .insert(schema.plans)
    .values({ id: 'free', name: 'Free', monthlyPricePerSeat: '0' })
    .onConflictDoNothing();
  a = await provisionMinimalTenant(`rls-a-${STAMP}`, 'Tenant A secret task');
  b = await provisionMinimalTenant(`rls-b-${STAMP}`, 'Tenant B secret task');
});

afterAll(async () => {
  // Cascade wipes all child rows.
  await systemDb().execute(sql`DELETE FROM tenants WHERE id IN (${a.tenantId}, ${b.tenantId})`);
  await closePools();
});

describe('RLS tenant isolation', () => {
  it('tenant A sees only its own tasks', async () => {
    const rows = await withTenant(a.tenantId, (db) => db.select().from(schema.tasks));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.tenantId === a.tenantId)).toBe(true);
    expect(rows.some((r) => r.id === b.taskId)).toBe(false);
  });

  it('tenant B sees only its own tasks', async () => {
    const rows = await withTenant(b.tenantId, (db) => db.select().from(schema.tasks));
    expect(rows.every((r) => r.tenantId === b.tenantId)).toBe(true);
    expect(rows.some((r) => r.id === a.taskId)).toBe(false);
  });

  it('tenant A cannot read tenant B by id', async () => {
    const rows = await withTenant(a.tenantId, (db) =>
      db.select().from(schema.tasks).where(sql`${schema.tasks.id} = ${b.taskId}`),
    );
    expect(rows).toHaveLength(0);
  });

  it('a query WITHOUT tenant context sees zero rows (fails closed)', async () => {
    const res = await getAppPool().query('SELECT * FROM tasks');
    expect(res.rows).toHaveLength(0);
    const res2 = await getAppPool().query('SELECT * FROM tenants');
    expect(res2.rows).toHaveLength(0);
  });

  it('tenant A cannot INSERT a row stamped with tenant B (WITH CHECK)', async () => {
    await expect(
      withTenant(a.tenantId, (db) =>
        db.insert(schema.clients).values({ tenantId: b.tenantId, name: 'smuggled' }),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('tenant A cannot UPDATE across the boundary (rows invisible, 0 affected)', async () => {
    const updated = await withTenant(a.tenantId, (db) =>
      db
        .update(schema.tasks)
        .set({ title: 'hijacked' })
        .where(sql`${schema.tasks.id} = ${b.taskId}`)
        .returning(),
    );
    expect(updated).toHaveLength(0);
    const check = await withTenant(b.tenantId, (db) =>
      db.select().from(schema.tasks).where(sql`${schema.tasks.id} = ${b.taskId}`),
    );
    expect(check[0]!.title).toBe('Tenant B secret task');
  });
});
