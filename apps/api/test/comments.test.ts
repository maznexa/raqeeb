import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { closePools, schema, systemDb, withTenant } from '@raqeeb/db';
import { and, eq } from 'drizzle-orm';
import { generateKeyBetween } from 'fractional-indexing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TenantContext } from '../src/auth/decorators';
import { CommentsService } from '../src/collab/comments.service';
import { AuditService } from '../src/platform/audit.service';
import { OutboxService } from '../src/platform/outbox.service';

/**
 * CommentsService against REAL Postgres (fixture pattern from packages/db/test/rls.test.ts).
 * Requires a migrated database: docker compose up -d && pnpm db:migrate.
 */

process.env.DATABASE_URL ??= 'postgres://raqeeb_app:raqeeb_app@localhost:5432/raqeeb';
process.env.DATABASE_URL_SYSTEM ??= 'postgres://raqeeb_system:raqeeb_system@localhost:5432/raqeeb';

const STAMP = Date.now().toString(36);

interface Member {
  membershipId: string;
  accountId: string;
}

interface Fixture {
  tenantId: string;
  taskId: string;
  members: Member[];
}

async function provisionTenant(slug: string, memberNames: string[]): Promise<Fixture> {
  const db = systemDb();
  const [tenant] = await db
    .insert(schema.tenants)
    .values({ name: slug, slug, planId: 'free' })
    .returning();

  const members: Member[] = [];
  for (const name of memberNames) {
    const [account] = await db
      .insert(schema.accounts)
      .values({ email: `${name.toLowerCase()}-${slug}@test.local`, displayName: name })
      .returning();
    const [membership] = await db
      .insert(schema.memberships)
      .values({ tenantId: tenant!.id, accountId: account!.id, displayName: name })
      .returning();
    members.push({ membershipId: membership!.id, accountId: account!.id });
  }

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
      key: `C${slug.slice(-6).toUpperCase().replace(/[^A-Z0-9]/g, 'X')}`,
      position: generateKeyBetween(null, null),
    })
    .returning();
  const [task] = await db
    .insert(schema.tasks)
    .values({
      tenantId: tenant!.id,
      itemTypeId: itemType!.id,
      title: 'Commentable task',
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
  return { tenantId: tenant!.id, taskId: task!.id, members };
}

const service = new CommentsService(new AuditService(), new OutboxService());

let a: Fixture;
let b: Fixture;

const ctx = (f: Fixture, member: Member, role: TenantContext['role'] = 'member'): TenantContext => ({
  tenantId: f.tenantId,
  membershipId: member.membershipId,
  role,
});

beforeAll(async () => {
  await systemDb()
    .insert(schema.plans)
    .values({ id: 'free', name: 'Free', monthlyPricePerSeat: '0' })
    .onConflictDoNothing();
  a = await provisionTenant(`cmt-a-${STAMP}`, ['Amal', 'Badr', 'Dana']);
  b = await provisionTenant(`cmt-b-${STAMP}`, ['Zayd']);
});

afterAll(async () => {
  const db = systemDb();
  await db.delete(schema.tenants).where(eq(schema.tenants.id, a.tenantId));
  await db.delete(schema.tenants).where(eq(schema.tenants.id, b.tenantId));
  for (const m of [...a.members, ...b.members]) {
    await db.delete(schema.accounts).where(eq(schema.accounts.id, m.accountId));
  }
  await closePools();
});

describe('CommentsService', () => {
  it('creates a comment and lists it back with author display name', async () => {
    const author = ctx(a, a.members[0]!);
    const created = await service.create(author, a.taskId, { body: 'first!' });

    expect(created.taskId).toBe(a.taskId);
    expect(created.body).toBe('first!');
    expect(created.author).toEqual({ membershipId: a.members[0]!.membershipId, displayName: 'Amal' });
    expect(created.edited).toBe(false);

    const listed = await service.list(author, a.taskId);
    expect(listed.some((c) => c.id === created.id && c.body === 'first!')).toBe(true);

    // Outbox event and audit entry committed atomically with the comment.
    const events = await withTenant(a.tenantId, (db) =>
      db
        .select()
        .from(schema.outboxEvents)
        .where(
          and(eq(schema.outboxEvents.entityId, created.id), eq(schema.outboxEvents.eventType, 'comment.created')),
        ),
    );
    expect(events).toHaveLength(1);
    const audits = await withTenant(a.tenantId, (db) =>
      db
        .select()
        .from(schema.auditLogs)
        .where(and(eq(schema.auditLogs.entityId, created.id), eq(schema.auditLogs.action, 'comment.create'))),
    );
    expect(audits).toHaveLength(1);
  });

  it('allows only the author to edit; a successful edit flips the edited flag', async () => {
    const author = ctx(a, a.members[0]!);
    const other = ctx(a, a.members[1]!);
    const created = await service.create(author, a.taskId, { body: 'draft' });

    await expect(service.update(other, created.id, { body: 'hijacked' })).rejects.toThrow(
      ForbiddenException,
    );

    const updated = await service.update(author, created.id, { body: 'final' });
    expect(updated.body).toBe('final');
    expect(updated.edited).toBe(true);
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(new Date(updated.createdAt).getTime());
  });

  it('soft-deletes: hidden from list, row retained, further edits 404', async () => {
    const author = ctx(a, a.members[0]!);
    const other = ctx(a, a.members[1]!);
    const admin = ctx(a, a.members[2]!, 'admin');
    const created = await service.create(author, a.taskId, { body: 'to be removed' });

    // A plain non-author member may not delete; an admin may moderate.
    await expect(service.remove(other, created.id)).rejects.toThrow(ForbiddenException);
    await expect(service.remove(admin, created.id)).resolves.toEqual({ deleted: true });

    const listed = await service.list(author, a.taskId);
    expect(listed.some((c) => c.id === created.id)).toBe(false);

    const [row] = await withTenant(a.tenantId, (db) =>
      db.select().from(schema.comments).where(eq(schema.comments.id, created.id)),
    );
    expect(row!.deletedAt).not.toBeNull();

    await expect(service.update(author, created.id, { body: 'zombie' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('treats a cross-tenant task as not found (RLS-invisible container)', async () => {
    const intruder = ctx(b, b.members[0]!);
    await expect(service.create(intruder, a.taskId, { body: 'intrusion' })).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.list(intruder, a.taskId)).rejects.toThrow(NotFoundException);
  });
});
