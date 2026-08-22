import { hash } from '@node-rs/argon2';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { generateKeyBetween } from 'fractional-indexing';
import { createHash } from 'node:crypto';
import pg from 'pg';
import * as schema from './schema';

/**
 * Dev/demo seed. Runs on the SYSTEM role (BYPASSRLS) because it writes across
 * two tenants in one pass. Idempotent: skips a tenant whose slug already exists.
 *
 * Seeds (per plan "Definition of runnable"):
 *  - plans (free/pro/business/enterprise)
 *  - 3 accounts (password for all: password123)
 *  - Tenant "Raqeeb Demo" (en) + tenant "وكالة الأفق" (ar — forces RTL testing)
 *  - default workflow (Backlog/In Progress/In Review/Done/Cancelled → canonical groups)
 *  - 2 projects in the demo tenant (one client-linked), sections, ~15 tasks
 *    incl. one multi-homed task, one milestone, one dependency chain
 *  - a deterministic PAT for API smoke tests (printed at the end)
 */
const url =
  process.env.DATABASE_URL_SYSTEM ?? 'postgres://raqeeb_system:raqeeb_system@localhost:5432/raqeeb';

const SEED_PAT = 'raq_pat_devseed_2f8c1b6a9d4e037';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Generate n ordered fractional keys. */
function keys(n: number): string[] {
  const out: string[] = [];
  let prev: string | null = null;
  for (let i = 0; i < n; i++) {
    prev = generateKeyBetween(prev, null);
    out.push(prev);
  }
  return out;
}

async function main() {
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool, { schema });

  // ---- plans ----------------------------------------------------------------
  const planRows = [
    {
      id: 'free',
      name: 'Free',
      monthlyPricePerSeat: '0',
      features: { customStatuses: true, multipleAssignees: true, timeTracking: true },
      limits: { members: 5, automationRunsPerMonth: 100, storageGb: 1 },
    },
    {
      id: 'pro',
      name: 'Pro',
      monthlyPricePerSeat: '9',
      features: {
        customStatuses: true,
        multipleAssignees: true,
        timeTracking: true,
        automations: true,
        forms: true,
        guests: true,
      },
      limits: { members: null, automationRunsPerMonth: 5000, storageGb: 50 },
    },
    {
      id: 'business',
      name: 'Business',
      monthlyPricePerSeat: '19',
      features: {
        customStatuses: true,
        multipleAssignees: true,
        timeTracking: true,
        automations: true,
        forms: true,
        guests: true,
        financials: true,
        retainers: true,
        profitability: true,
        resourcePlanning: true,
        clientPortal: true,
      },
      limits: { members: null, automationRunsPerMonth: 25000, storageGb: 250 },
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      monthlyPricePerSeat: '0',
      features: {
        customStatuses: true,
        multipleAssignees: true,
        timeTracking: true,
        automations: true,
        forms: true,
        guests: true,
        financials: true,
        retainers: true,
        profitability: true,
        resourcePlanning: true,
        clientPortal: true,
        samlSso: true,
        scim: true,
        auditLogUi: true,
      },
      limits: { members: null, automationRunsPerMonth: null, storageGb: null },
    },
  ];
  for (const p of planRows) {
    await db.insert(schema.plans).values(p).onConflictDoNothing();
  }
  console.log('[seed] plans ready');

  // ---- accounts ---------------------------------------------------------------
  const passwordHash = await hash('password123');
  const accountDefs = [
    { email: 'owner@raqeeb.dev', displayName: 'Noor Al-Rashid', locale: 'en' },
    { email: 'sara@raqeeb.dev', displayName: 'Sara Haddad', locale: 'en' },
    { email: 'client@acme.example', displayName: 'Acme Reviewer', locale: 'en' },
  ];
  const accountIds: Record<string, string> = {};
  for (const a of accountDefs) {
    const existing = await db.query.accounts.findFirst({
      where: eq(schema.accounts.email, a.email),
    });
    if (existing) {
      accountIds[a.email] = existing.id;
    } else {
      const [row] = await db
        .insert(schema.accounts)
        .values({ ...a, passwordHash, emailVerifiedAt: new Date() })
        .returning({ id: schema.accounts.id });
      accountIds[a.email] = row!.id;
    }
  }
  console.log('[seed] accounts ready');

  // ---- helper: provision one tenant ----------------------------------------
  async function provisionTenant(opts: {
    name: string;
    slug: string;
    planId: string;
    defaultLocale: string;
    spaceName: string;
  }) {
    const existing = await db.query.tenants.findFirst({
      where: eq(schema.tenants.slug, opts.slug),
    });
    if (existing) {
      console.log(`[seed] tenant "${opts.slug}" already exists — skipping`);
      return null;
    }
    const [tenant] = await db
      .insert(schema.tenants)
      .values({
        name: opts.name,
        slug: opts.slug,
        planId: opts.planId,
        subscriptionStatus: 'trialing',
        defaultLocale: opts.defaultLocale,
      })
      .returning();

    const [workflow] = await db
      .insert(schema.workflows)
      .values({ tenantId: tenant!.id, name: 'Default', isDefault: true })
      .returning();

    const statusDefs = [
      { name: 'Backlog', color: '#9ca3af', canonicalGroup: 'not_started' as const },
      { name: 'In Progress', color: '#3b82f6', canonicalGroup: 'active' as const },
      { name: 'In Review', color: '#f59e0b', canonicalGroup: 'active' as const },
      { name: 'Done', color: '#22c55e', canonicalGroup: 'done' as const },
      { name: 'Cancelled', color: '#64748b', canonicalGroup: 'cancelled' as const },
    ];
    const statusKeys = keys(statusDefs.length);
    const statusRows = await db
      .insert(schema.statuses)
      .values(
        statusDefs.map((s, i) => ({
          tenantId: tenant!.id,
          workflowId: workflow!.id,
          position: statusKeys[i]!,
          ...s,
        })),
      )
      .returning();

    const itemTypeRows = await db
      .insert(schema.itemTypes)
      .values([
        { tenantId: tenant!.id, name: 'Task', icon: 'check-square', baseKind: 'task' as const, isSystem: true },
        { tenantId: tenant!.id, name: 'Milestone', icon: 'flag', baseKind: 'milestone' as const, isSystem: true },
        { tenantId: tenant!.id, name: 'Approval', icon: 'stamp', baseKind: 'approval' as const, isSystem: true },
      ])
      .returning();

    const [space] = await db
      .insert(schema.spaces)
      .values({ tenantId: tenant!.id, name: opts.spaceName, position: keys(1)[0]! })
      .returning();

    return { tenant: tenant!, workflow: workflow!, statusRows, itemTypeRows, space: space! };
  }

  // ---- tenant 1: Raqeeb Demo (en) -------------------------------------------
  const t1 = await provisionTenant({
    name: 'Raqeeb Demo',
    slug: 'raqeeb-demo',
    planId: 'business',
    defaultLocale: 'en',
    spaceName: 'General',
  });

  if (t1) {
    const byName = (n: string) => t1.statusRows.find((s) => s.name === n)!;
    const typeByKind = (k: string) => t1.itemTypeRows.find((t) => t.baseKind === k)!;

    const [ownerM] = await db
      .insert(schema.memberships)
      .values({
        tenantId: t1.tenant.id,
        accountId: accountIds['owner@raqeeb.dev']!,
        role: 'owner',
        isBillableSeat: true,
      })
      .returning();
    const [saraM] = await db
      .insert(schema.memberships)
      .values({
        tenantId: t1.tenant.id,
        accountId: accountIds['sara@raqeeb.dev']!,
        role: 'member',
        isBillableSeat: true,
      })
      .returning();
    // Client users are NEVER billable seats (Teamwork lesson).
    await db.insert(schema.memberships).values({
      tenantId: t1.tenant.id,
      accountId: accountIds['client@acme.example']!,
      role: 'client',
      isBillableSeat: false,
    });

    const [acme] = await db
      .insert(schema.clients)
      .values({ tenantId: t1.tenant.id, name: 'Acme Corp', currency: 'USD' })
      .returning();

    const projKeys = keys(2);
    const [web] = await db
      .insert(schema.projects)
      .values({
        tenantId: t1.tenant.id,
        spaceId: t1.space.id,
        clientId: acme!.id,
        workflowId: t1.workflow.id,
        name: 'Website Revamp',
        key: 'WEB',
        color: '#6366f1',
        position: projKeys[0]!,
      })
      .returning();
    const [mkt] = await db
      .insert(schema.projects)
      .values({
        tenantId: t1.tenant.id,
        spaceId: t1.space.id,
        workflowId: t1.workflow.id,
        name: 'Marketing',
        key: 'MKT',
        color: '#ec4899',
        position: projKeys[1]!,
      })
      .returning();

    const sectionNames = ['Planning', 'Build', 'Launch'];
    const sectionKeys = keys(sectionNames.length);
    const sectionRows = await db
      .insert(schema.sections)
      .values(
        sectionNames.map((name, i) => ({
          tenantId: t1.tenant.id,
          projectId: web!.id,
          name,
          position: sectionKeys[i]!,
        })),
      )
      .returning();

    // ---- tasks in WEB --------------------------------------------------------
    type TaskDef = {
      title: string;
      status: string;
      section: number;
      kind?: 'task' | 'milestone' | 'approval';
      priority?: 'urgent' | 'high' | 'normal' | 'low';
      estimate?: number;
      due?: string;
      assign?: string[];
      description?: string;
    };
    const webTasks: TaskDef[] = [
      { title: 'Audit current site content', status: 'Done', section: 0, estimate: 240, assign: ['sara'] },
      { title: 'Define information architecture', status: 'Done', section: 0, estimate: 480, assign: ['owner'] },
      { title: 'Stakeholder interviews', status: 'In Review', section: 0, estimate: 360, assign: ['owner', 'sara'] },
      { title: 'Design system & tokens', status: 'In Progress', section: 1, priority: 'high', estimate: 960, assign: ['sara'] },
      { title: 'Homepage design', status: 'In Progress', section: 1, priority: 'high', estimate: 720, assign: ['sara'] },
      { title: 'Homepage design approval', status: 'Backlog', section: 1, kind: 'approval', assign: ['owner'] },
      { title: 'Build marketing pages', status: 'Backlog', section: 1, estimate: 1440 },
      { title: 'CMS migration', status: 'Backlog', section: 1, estimate: 1200 },
      { title: 'QA & accessibility pass', status: 'Backlog', section: 2, estimate: 600 },
      { title: 'Content freeze', status: 'Backlog', section: 2 },
      { title: 'Go-live', status: 'Backlog', section: 2, kind: 'milestone', due: '2026-10-01' },
      { title: 'Post-launch retrospective', status: 'Backlog', section: 2, priority: 'low' },
    ];

    const memberByName: Record<string, string> = { owner: ownerM!.id, sara: saraM!.id };
    const webTaskIds: string[] = [];
    let taskCounter = 1;
    const posKeys = keys(webTasks.length);
    for (let i = 0; i < webTasks.length; i++) {
      const def = webTasks[i]!;
      const [task] = await db
        .insert(schema.tasks)
        .values({
          tenantId: t1.tenant.id,
          itemTypeId: typeByKind(def.kind ?? 'task').id,
          title: def.title,
          description: def.description,
          statusId: byName(def.status).id,
          approvalStatus: def.kind === 'approval' ? 'pending' : null,
          priority: def.priority ?? 'normal',
          estimateMinutes: def.estimate,
          dueDate: def.due,
          taskNumber: taskCounter++,
          createdByMembershipId: ownerM!.id,
          completedAt: byName(def.status).canonicalGroup === 'done' ? new Date() : null,
        })
        .returning();
      webTaskIds.push(task!.id);
      await db.insert(schema.taskLocations).values({
        tenantId: t1.tenant.id,
        taskId: task!.id,
        projectId: web!.id,
        sectionId: sectionRows[def.section]!.id,
        position: posKeys[i]!,
        isPrimary: true,
      });
      for (const a of def.assign ?? []) {
        await db.insert(schema.taskAssignees).values({
          tenantId: t1.tenant.id,
          taskId: task!.id,
          membershipId: memberByName[a]!,
        });
      }
    }
    await db.update(schema.projects).set({ nextTaskNumber: taskCounter }).where(eq(schema.projects.id, web!.id));

    // Subtasks under "Design system & tokens"
    const parentId = webTaskIds[3]!;
    for (const [j, sub] of ['Color palette', 'Typography scale'].entries()) {
      const [task] = await db
        .insert(schema.tasks)
        .values({
          tenantId: t1.tenant.id,
          itemTypeId: typeByKind('task').id,
          parentTaskId: parentId,
          title: sub,
          statusId: byName(j === 0 ? 'Done' : 'In Progress').id,
          taskNumber: taskCounter++,
          createdByMembershipId: saraM!.id,
        })
        .returning();
      await db.insert(schema.taskLocations).values({
        tenantId: t1.tenant.id,
        taskId: task!.id,
        projectId: web!.id,
        sectionId: sectionRows[1]!.id,
        position: generateKeyBetween(posKeys[posKeys.length - 1]!, null),
        isPrimary: true,
      });
    }
    await db.update(schema.projects).set({ nextTaskNumber: taskCounter }).where(eq(schema.projects.id, web!.id));

    // MKT task + MULTI-HOME: "Build marketing pages" also lives in Marketing (D2)
    const [mktTask] = await db
      .insert(schema.tasks)
      .values({
        tenantId: t1.tenant.id,
        itemTypeId: typeByKind('task').id,
        title: 'Launch announcement campaign',
        statusId: byName('Backlog').id,
        taskNumber: 1,
        createdByMembershipId: ownerM!.id,
      })
      .returning();
    await db.insert(schema.taskLocations).values({
      tenantId: t1.tenant.id,
      taskId: mktTask!.id,
      projectId: mkt!.id,
      position: keys(1)[0]!,
      isPrimary: true,
    });
    await db.update(schema.projects).set({ nextTaskNumber: 2 }).where(eq(schema.projects.id, mkt!.id));
    await db.insert(schema.taskLocations).values({
      tenantId: t1.tenant.id,
      taskId: webTaskIds[6]!, // "Build marketing pages"
      projectId: mkt!.id,
      position: generateKeyBetween(keys(1)[0]!, null),
      isPrimary: false,
    });

    // Dependency chain: CMS migration → QA pass → Go-live (FS)
    await db.insert(schema.taskDependencies).values([
      {
        tenantId: t1.tenant.id,
        predecessorId: webTaskIds[7]!,
        successorId: webTaskIds[8]!,
      },
      {
        tenantId: t1.tenant.id,
        predecessorId: webTaskIds[8]!,
        successorId: webTaskIds[10]!,
      },
    ]);

    // Deterministic PAT for smoke tests
    await db.insert(schema.personalAccessTokens).values({
      tenantId: t1.tenant.id,
      membershipId: ownerM!.id,
      name: 'Seed smoke-test token',
      tokenPrefix: SEED_PAT.slice(0, 16),
      tokenHash: sha256(SEED_PAT),
    });

    console.log('[seed] tenant raqeeb-demo ready');
  }

  // ---- tenant 2: Arabic tenant (RTL) -----------------------------------------
  const t2 = await provisionTenant({
    name: 'وكالة الأفق',
    slug: 'alufq',
    planId: 'pro',
    defaultLocale: 'ar',
    spaceName: 'عام',
  });

  if (t2) {
    const byName = (n: string) => t2.statusRows.find((s) => s.name === n)!;
    const typeByKind = (k: string) => t2.itemTypeRows.find((t) => t.baseKind === k)!;
    const [ownerM2] = await db
      .insert(schema.memberships)
      .values({
        tenantId: t2.tenant.id,
        accountId: accountIds['owner@raqeeb.dev']!, // cross-tenant membership (D9)
        role: 'owner',
        isBillableSeat: true,
        displayName: 'نور الراشد',
      })
      .returning();

    const [proj] = await db
      .insert(schema.projects)
      .values({
        tenantId: t2.tenant.id,
        spaceId: t2.space.id,
        workflowId: t2.workflow.id,
        name: 'إطلاق الموقع الجديد',
        key: 'LAUNCH',
        color: '#10b981',
        position: keys(1)[0]!,
      })
      .returning();

    const arTitles = ['تحليل المتطلبات', 'تصميم الواجهة الرئيسية', 'مراجعة المحتوى العربي'];
    const arKeys = keys(arTitles.length);
    for (let i = 0; i < arTitles.length; i++) {
      const [task] = await db
        .insert(schema.tasks)
        .values({
          tenantId: t2.tenant.id,
          itemTypeId: typeByKind('task').id,
          title: arTitles[i]!,
          statusId: byName(i === 0 ? 'Done' : 'In Progress').id,
          taskNumber: i + 1,
          createdByMembershipId: ownerM2!.id,
        })
        .returning();
      await db.insert(schema.taskLocations).values({
        tenantId: t2.tenant.id,
        taskId: task!.id,
        projectId: proj!.id,
        position: arKeys[i]!,
        isPrimary: true,
      });
    }
    await db.update(schema.projects).set({ nextTaskNumber: 4 }).where(eq(schema.projects.id, proj!.id));
    console.log('[seed] tenant alufq (ar) ready');
  }

  await pool.end();
  console.log('\n[seed] complete.');
  console.log('[seed] demo login: owner@raqeeb.dev / password123 (also sara@raqeeb.dev, client@acme.example)');
  console.log(`[seed] smoke-test PAT (tenant raqeeb-demo): ${SEED_PAT}`);
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
