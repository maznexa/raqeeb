import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateTenantInput, InviteMemberInput, MyTenantDto } from '@raqeeb/contracts';
import { schema, systemDb } from '@raqeeb/db';
import { and, eq } from 'drizzle-orm';
import { generateKeyBetween } from 'fractional-indexing';
import { createHash, randomBytes } from 'node:crypto';
import type { TenantContext } from '../auth/decorators';

const RESERVED_SLUGS = new Set([
  'www', 'api', 'app', 'admin', 'billing', 'help', 'support', 'docs', 'status', 'mail',
]);

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .slice(0, 40);
  return base.length >= 3 ? base : `org-${randomBytes(3).toString('hex')}`;
}

/**
 * Tenant provisioning + membership management.
 *
 * Provisioning runs on the SYSTEM pool by design: it creates the tenant row that
 * RLS scoping would otherwise require to already exist. Everything is one
 * transaction — a failed provision leaves nothing behind.
 *
 * Seed defaults per tenant (plan: "Definition of runnable"):
 * default workflow + 5 statuses, 3 system item types, one Space, one sample project.
 */
@Injectable()
export class TenantsService {
  async provision(
    accountId: string,
    input: CreateTenantInput | { name: string; defaultLocale?: string },
  ) {
    const db = systemDb();
    const wanted = ('slug' in input && input.slug) || slugify(input.name);
    if (RESERVED_SLUGS.has(wanted)) throw new ConflictException('This slug is reserved');

    const existing = await db.query.tenants.findFirst({ where: eq(schema.tenants.slug, wanted) });
    const slug = existing ? `${wanted}-${randomBytes(2).toString('hex')}` : wanted;
    const isArabic = ('defaultLocale' in input ? input.defaultLocale : 'en') === 'ar';

    return db.transaction(async (tx) => {
      const [tenant] = await tx
        .insert(schema.tenants)
        .values({
          name: input.name,
          slug,
          planId: 'free',
          subscriptionStatus: 'trialing',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 3600 * 1000),
          defaultLocale: isArabic ? 'ar' : 'en',
        })
        .returning();

      const [membership] = await tx
        .insert(schema.memberships)
        .values({ tenantId: tenant!.id, accountId, role: 'owner', isBillableSeat: true })
        .returning();

      const [workflow] = await tx
        .insert(schema.workflows)
        .values({ tenantId: tenant!.id, name: 'Default', isDefault: true })
        .returning();

      const statusDefs = [
        { name: isArabic ? 'قائمة الانتظار' : 'Backlog', color: '#9ca3af', canonicalGroup: 'not_started' as const },
        { name: isArabic ? 'قيد التنفيذ' : 'In Progress', color: '#3b82f6', canonicalGroup: 'active' as const },
        { name: isArabic ? 'قيد المراجعة' : 'In Review', color: '#f59e0b', canonicalGroup: 'active' as const },
        { name: isArabic ? 'مكتملة' : 'Done', color: '#22c55e', canonicalGroup: 'done' as const },
        { name: isArabic ? 'ملغاة' : 'Cancelled', color: '#64748b', canonicalGroup: 'cancelled' as const },
      ];
      let pos: string | null = null;
      const statusRows = [];
      for (const def of statusDefs) {
        pos = generateKeyBetween(pos, null);
        const [s] = await tx
          .insert(schema.statuses)
          .values({ tenantId: tenant!.id, workflowId: workflow!.id, position: pos, ...def })
          .returning();
        statusRows.push(s!);
      }

      await tx.insert(schema.itemTypes).values([
        { tenantId: tenant!.id, name: 'Task', icon: 'check-square', baseKind: 'task', isSystem: true },
        { tenantId: tenant!.id, name: 'Milestone', icon: 'flag', baseKind: 'milestone', isSystem: true },
        { tenantId: tenant!.id, name: 'Approval', icon: 'stamp', baseKind: 'approval', isSystem: true },
      ]);

      const [space] = await tx
        .insert(schema.spaces)
        .values({
          tenantId: tenant!.id,
          name: isArabic ? 'عام' : 'General',
          position: generateKeyBetween(null, null),
        })
        .returning();

      const [project] = await tx
        .insert(schema.projects)
        .values({
          tenantId: tenant!.id,
          spaceId: space!.id,
          workflowId: workflow!.id,
          name: isArabic ? 'ابدأ من هنا' : 'Getting Started',
          key: 'START',
          color: '#6366f1',
          position: generateKeyBetween(null, null),
          nextTaskNumber: 3,
        })
        .returning();

      const taskType = await tx.query.itemTypes.findFirst({
        where: and(eq(schema.itemTypes.tenantId, tenant!.id), eq(schema.itemTypes.baseKind, 'task')),
      });
      const starterTitles = isArabic
        ? ['أنشئ مهمتك الأولى', 'ادعُ فريقك']
        : ['Create your first task', 'Invite your team'];
      let taskPos: string | null = null;
      for (let i = 0; i < starterTitles.length; i++) {
        taskPos = generateKeyBetween(taskPos, null);
        const [task] = await tx
          .insert(schema.tasks)
          .values({
            tenantId: tenant!.id,
            itemTypeId: taskType!.id,
            title: starterTitles[i]!,
            statusId: statusRows[0]!.id,
            taskNumber: i + 1,
            createdByMembershipId: membership!.id,
          })
          .returning();
        await tx.insert(schema.taskLocations).values({
          tenantId: tenant!.id,
          taskId: task!.id,
          projectId: project!.id,
          position: taskPos,
          isPrimary: true,
        });
      }

      return {
        id: tenant!.id,
        name: tenant!.name,
        slug: tenant!.slug,
        planId: tenant!.planId,
        subscriptionStatus: tenant!.subscriptionStatus,
        defaultLocale: tenant!.defaultLocale,
      };
    });
  }

  /** All tenants the account belongs to (tenant switcher) — cross-tenant by nature. */
  async myTenants(accountId: string): Promise<MyTenantDto[]> {
    const rows = await systemDb()
      .select({
        tenantId: schema.tenants.id,
        name: schema.tenants.name,
        slug: schema.tenants.slug,
        role: schema.memberships.role,
        membershipId: schema.memberships.id,
        defaultLocale: schema.tenants.defaultLocale,
      })
      .from(schema.memberships)
      .innerJoin(schema.tenants, eq(schema.memberships.tenantId, schema.tenants.id))
      .where(and(eq(schema.memberships.accountId, accountId), eq(schema.memberships.status, 'active')));
    return rows as MyTenantDto[];
  }

  async currentTenant(ctx: TenantContext) {
    const t = await systemDb().query.tenants.findFirst({
      where: eq(schema.tenants.id, ctx.tenantId),
    });
    if (!t) throw new NotFoundException('Tenant not found');
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      planId: t.planId,
      subscriptionStatus: t.subscriptionStatus,
      defaultLocale: t.defaultLocale,
      role: ctx.role,
    };
  }

  async members(ctx: TenantContext) {
    const rows = await systemDb()
      .select({
        membershipId: schema.memberships.id,
        accountId: schema.accounts.id,
        email: schema.accounts.email,
        accountName: schema.accounts.displayName,
        tenantDisplayName: schema.memberships.displayName,
        role: schema.memberships.role,
        isBillableSeat: schema.memberships.isBillableSeat,
      })
      .from(schema.memberships)
      .innerJoin(schema.accounts, eq(schema.memberships.accountId, schema.accounts.id))
      .where(and(eq(schema.memberships.tenantId, ctx.tenantId), eq(schema.memberships.status, 'active')));
    return rows.map((r) => ({
      membershipId: r.membershipId,
      accountId: r.accountId,
      email: r.email,
      displayName: r.tenantDisplayName ?? r.accountName,
      role: r.role,
      isBillableSeat: r.isBillableSeat,
    }));
  }

  /**
   * Create an invitation. Scaffold: the invite URL is returned/logged; SMTP delivery
   * (Mailpit in dev) lands with the notifications module in P2.
   */
  async invite(ctx: TenantContext, input: InviteMemberInput) {
    const token = `raq_invite_${randomBytes(24).toString('base64url')}`;
    const isClientLike = input.role === 'client' || input.role === 'guest';
    const [invitation] = await systemDb()
      .insert(schema.invitations)
      .values({
        tenantId: ctx.tenantId,
        email: input.email.toLowerCase(),
        role: input.role,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        invitedByMembershipId: ctx.membershipId,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      })
      .returning();
    return {
      id: invitation!.id,
      email: invitation!.email,
      role: invitation!.role,
      // Clients/guests never consume billable seats when they accept.
      willBeBillableSeat: !isClientLike,
      inviteToken: token, // dev convenience; delivered by email in P2
      expiresAt: invitation!.expiresAt,
    };
  }
}
