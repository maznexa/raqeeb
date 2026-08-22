import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AddTaskLocationInput,
  CreateDependencyInput,
  CreateTaskInput,
  MoveTaskInput,
  UpdateTaskInput,
} from '@raqeeb/contracts';
import { schema, withTenant, type Db } from '@raqeeb/db';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { generateKeyBetween } from 'fractional-indexing';
import type { TenantContext } from '../auth/decorators';
import { AuditService } from '../platform/audit.service';
import { OutboxService } from '../platform/outbox.service';

/**
 * The work engine's hard primitives, proven end-to-end (per plan):
 * multi-homing (task_locations), fractional ordering, status transitions with
 * canonical-group semantics, dependency DAG with cycle rejection — all inside
 * withTenant() so RLS scopes every statement.
 */
@Injectable()
export class TasksService {
  constructor(
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  // ---- helpers ---------------------------------------------------------------

  private async positionFor(
    db: Db,
    projectId: string,
    opts: { insertBeforeTaskId?: string; insertAfterTaskId?: string },
  ): Promise<string> {
    const neighborId = opts.insertBeforeTaskId ?? opts.insertAfterTaskId;
    if (!neighborId) {
      const rows = await db
        .select({ position: schema.taskLocations.position })
        .from(schema.taskLocations)
        .where(eq(schema.taskLocations.projectId, projectId))
        .orderBy(asc(schema.taskLocations.position));
      return generateKeyBetween(rows.at(-1)?.position ?? null, null);
    }

    const ordered = await db
      .select({ taskId: schema.taskLocations.taskId, position: schema.taskLocations.position })
      .from(schema.taskLocations)
      .where(eq(schema.taskLocations.projectId, projectId))
      .orderBy(asc(schema.taskLocations.position));
    const idx = ordered.findIndex((r) => r.taskId === neighborId);
    if (idx === -1) throw new BadRequestException('insert_before/after task is not in this project');

    if (opts.insertBeforeTaskId) {
      const prev = idx > 0 ? ordered[idx - 1]!.position : null;
      return generateKeyBetween(prev, ordered[idx]!.position);
    }
    const next = idx < ordered.length - 1 ? ordered[idx + 1]!.position : null;
    return generateKeyBetween(ordered[idx]!.position, next);
  }

  private async nextTaskNumber(db: Db, projectId: string): Promise<number> {
    const [row] = await db
      .update(schema.projects)
      .set({ nextTaskNumber: sql`${schema.projects.nextTaskNumber} + 1` })
      .where(eq(schema.projects.id, projectId))
      .returning({ next: schema.projects.nextTaskNumber });
    if (!row) throw new NotFoundException('Project not found');
    return row.next - 1;
  }

  private async statusOrDefault(db: Db, projectId: string, statusId?: string) {
    const project = await db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
    });
    if (!project) throw new NotFoundException('Project not found');
    if (statusId) {
      const status = await db.query.statuses.findFirst({
        where: and(eq(schema.statuses.id, statusId), eq(schema.statuses.workflowId, project.workflowId)),
      });
      if (!status) throw new BadRequestException('Status does not belong to the project workflow');
      return { project, status };
    }
    const [first] = await db
      .select()
      .from(schema.statuses)
      .where(eq(schema.statuses.workflowId, project.workflowId))
      .orderBy(asc(schema.statuses.position))
      .limit(1);
    if (!first) throw new BadRequestException('Project workflow has no statuses');
    return { project, status: first };
  }

  // ---- commands --------------------------------------------------------------

  async create(ctx: TenantContext, input: CreateTaskInput) {
    return withTenant(ctx.tenantId, async (db) => {
      const { project, status } = await this.statusOrDefault(db, input.projectId, input.statusId);

      const itemType = await db.query.itemTypes.findFirst({
        where: and(
          eq(schema.itemTypes.baseKind, input.itemKind),
          eq(schema.itemTypes.isSystem, true),
        ),
      });
      if (!itemType) throw new BadRequestException(`No system item type for kind ${input.itemKind}`);

      if (input.sectionId) {
        const section = await db.query.sections.findFirst({
          where: and(eq(schema.sections.id, input.sectionId), eq(schema.sections.projectId, input.projectId)),
        });
        if (!section) throw new BadRequestException('Section does not belong to the project');
      }

      const taskNumber = await this.nextTaskNumber(db, input.projectId);
      const position = await this.positionFor(db, input.projectId, input);

      const [task] = await db
        .insert(schema.tasks)
        .values({
          tenantId: ctx.tenantId,
          itemTypeId: itemType.id,
          parentTaskId: input.parentTaskId,
          title: input.title,
          description: input.description,
          statusId: status.id,
          approvalStatus: input.itemKind === 'approval' ? 'pending' : null,
          priority: input.priority,
          estimateMinutes: input.estimateMinutes,
          startDate: input.startDate,
          dueDate: input.dueDate,
          taskNumber,
          completedAt: status.canonicalGroup === 'done' ? new Date() : null,
          createdByMembershipId: ctx.membershipId,
        })
        .returning();

      await db.insert(schema.taskLocations).values({
        tenantId: ctx.tenantId,
        taskId: task!.id,
        projectId: input.projectId,
        sectionId: input.sectionId,
        position,
        isPrimary: true,
      });

      if (input.assigneeMembershipIds.length > 0) {
        await db.insert(schema.taskAssignees).values(
          input.assigneeMembershipIds.map((membershipId) => ({
            tenantId: ctx.tenantId,
            taskId: task!.id,
            membershipId,
          })),
        );
      }

      await this.outbox.emit(db, ctx.tenantId, {
        eventType: 'task.created',
        entityType: 'task',
        entityId: task!.id,
        payload: { title: task!.title, projectId: input.projectId, humanId: `${project.key}-${taskNumber}` },
      });
      await this.audit.logIn(db, ctx.tenantId, {
        action: 'task.create',
        entityType: 'task',
        entityId: task!.id,
        actorMembershipId: ctx.membershipId,
      });

      return this.hydrate(db, task!.id);
    });
  }

  async listByProject(ctx: TenantContext, projectId: string) {
    return withTenant(ctx.tenantId, async (db) => {
      // RLS already hides foreign rows; this turns "invisible container" into 404
      // instead of an empty 200, per the API conventions doc.
      const project = await db.query.projects.findFirst({
        where: eq(schema.projects.id, projectId),
        columns: { id: true },
      });
      if (!project) throw new NotFoundException('Project not found');
      const locations = await db
        .select()
        .from(schema.taskLocations)
        .where(eq(schema.taskLocations.projectId, projectId))
        .orderBy(asc(schema.taskLocations.position));
      if (locations.length === 0) return [];
      const ids = locations.map((l) => l.taskId);
      const tasks = await this.hydrateMany(db, ids);
      const byId = new Map(tasks.map((t) => [t.id, t]));
      return locations
        .map((l) => {
          const t = byId.get(l.taskId);
          return t ? { ...t, sectionId: l.sectionId, isPrimaryHere: l.isPrimary } : null;
        })
        .filter(Boolean);
    });
  }

  async get(ctx: TenantContext, taskId: string) {
    return withTenant(ctx.tenantId, async (db) => {
      const task = await this.hydrate(db, taskId);
      if (!task) throw new NotFoundException('Task not found');
      return task;
    });
  }

  async update(ctx: TenantContext, taskId: string, input: UpdateTaskInput) {
    return withTenant(ctx.tenantId, async (db) => {
      const existing = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, taskId) });
      if (!existing) throw new NotFoundException('Task not found');

      let completedAt = existing.completedAt;
      let statusChange: { from: string; to: string } | undefined;
      if (input.statusId && input.statusId !== existing.statusId) {
        const status = await db.query.statuses.findFirst({
          where: eq(schema.statuses.id, input.statusId),
        });
        if (!status) throw new BadRequestException('Unknown status');
        completedAt = status.canonicalGroup === 'done' ? new Date() : null;
        statusChange = { from: existing.statusId, to: input.statusId };
      }

      const [updated] = await db
        .update(schema.tasks)
        .set({
          ...(input.title !== undefined && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.statusId !== undefined && { statusId: input.statusId }),
          ...(input.approvalStatus !== undefined && { approvalStatus: input.approvalStatus }),
          ...(input.priority !== undefined && { priority: input.priority }),
          ...(input.estimateMinutes !== undefined && { estimateMinutes: input.estimateMinutes }),
          ...(input.startDate !== undefined && { startDate: input.startDate }),
          ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
          completedAt,
          updatedAt: new Date(),
        })
        .where(eq(schema.tasks.id, taskId))
        .returning();

      if (statusChange) {
        await this.outbox.emit(db, ctx.tenantId, {
          eventType: 'task.status_changed',
          entityType: 'task',
          entityId: taskId,
          payload: statusChange,
        });
      }
      await this.audit.logIn(db, ctx.tenantId, {
        action: 'task.update',
        entityType: 'task',
        entityId: taskId,
        actorMembershipId: ctx.membershipId,
        metadata: { fields: Object.keys(input) },
      });
      return this.hydrate(db, updated!.id);
    });
  }

  /** Reorder/move within one of the task's locations (never exposes raw keys — D10). */
  async move(ctx: TenantContext, taskId: string, input: MoveTaskInput) {
    return withTenant(ctx.tenantId, async (db) => {
      const location = await db.query.taskLocations.findFirst({
        where: and(
          eq(schema.taskLocations.taskId, taskId),
          eq(schema.taskLocations.projectId, input.projectId),
        ),
      });
      if (!location) throw new NotFoundException('Task is not in this project');

      if (input.sectionId) {
        const section = await db.query.sections.findFirst({
          where: and(eq(schema.sections.id, input.sectionId), eq(schema.sections.projectId, input.projectId)),
        });
        if (!section) throw new BadRequestException('Section does not belong to the project');
      }

      const position = await this.positionFor(db, input.projectId, input);
      await db
        .update(schema.taskLocations)
        .set({
          position,
          ...(input.sectionId !== undefined && { sectionId: input.sectionId }),
        })
        .where(eq(schema.taskLocations.id, location.id));

      await this.outbox.emit(db, ctx.tenantId, {
        eventType: 'task.moved',
        entityType: 'task',
        entityId: taskId,
        payload: { projectId: input.projectId, sectionId: input.sectionId ?? location.sectionId },
      });
      return this.hydrate(db, taskId);
    });
  }

  /** D2 multi-homing: add the task to another project (non-primary location). */
  async addLocation(ctx: TenantContext, taskId: string, input: AddTaskLocationInput) {
    return withTenant(ctx.tenantId, async (db) => {
      const task = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, taskId) });
      if (!task) throw new NotFoundException('Task not found');
      const project = await db.query.projects.findFirst({
        where: eq(schema.projects.id, input.projectId),
      });
      if (!project) throw new NotFoundException('Project not found');

      const existing = await db.query.taskLocations.findFirst({
        where: and(
          eq(schema.taskLocations.taskId, taskId),
          eq(schema.taskLocations.projectId, input.projectId),
        ),
      });
      if (existing) throw new ConflictException('Task already lives in this project');

      const position = await this.positionFor(db, input.projectId, {});
      await db.insert(schema.taskLocations).values({
        tenantId: ctx.tenantId,
        taskId,
        projectId: input.projectId,
        sectionId: input.sectionId,
        position,
        isPrimary: false,
      });
      await this.outbox.emit(db, ctx.tenantId, {
        eventType: 'task.location_added',
        entityType: 'task',
        entityId: taskId,
        payload: { projectId: input.projectId },
      });
      return this.hydrate(db, taskId);
    });
  }

  async setAssignees(ctx: TenantContext, taskId: string, membershipIds: string[]) {
    return withTenant(ctx.tenantId, async (db) => {
      const task = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, taskId) });
      if (!task) throw new NotFoundException('Task not found');
      await db.delete(schema.taskAssignees).where(eq(schema.taskAssignees.taskId, taskId));
      if (membershipIds.length > 0) {
        await db.insert(schema.taskAssignees).values(
          membershipIds.map((membershipId) => ({ tenantId: ctx.tenantId, taskId, membershipId })),
        );
      }
      return this.hydrate(db, taskId);
    });
  }

  /** Dependency creation with DAG cycle rejection via recursive CTE (RLS-scoped). */
  async addDependency(ctx: TenantContext, input: CreateDependencyInput) {
    if (input.predecessorTaskId === input.successorTaskId) {
      throw new BadRequestException('A task cannot depend on itself');
    }
    return withTenant(ctx.tenantId, async (db) => {
      const found = await db
        .select({ id: schema.tasks.id })
        .from(schema.tasks)
        .where(inArray(schema.tasks.id, [input.predecessorTaskId, input.successorTaskId]));
      if (found.length !== 2) throw new NotFoundException('Task not found');

      // Would pred→succ close a cycle? Check whether pred is reachable FROM succ.
      const cycle = await db.execute(sql`
        WITH RECURSIVE reach AS (
          SELECT successor_id FROM task_dependencies WHERE predecessor_id = ${input.successorTaskId}
          UNION
          SELECT td.successor_id
          FROM task_dependencies td
          JOIN reach r ON td.predecessor_id = r.successor_id
        )
        SELECT 1 AS hit FROM reach WHERE successor_id = ${input.predecessorTaskId} LIMIT 1
      `);
      if (cycle.rows.length > 0) {
        throw new ConflictException('This dependency would create a cycle');
      }

      const [dep] = await db
        .insert(schema.taskDependencies)
        .values({
          tenantId: ctx.tenantId,
          predecessorId: input.predecessorTaskId,
          successorId: input.successorTaskId,
          dependencyType: input.dependencyType,
          lagDays: input.lagDays,
        })
        .onConflictDoNothing()
        .returning();
      if (!dep) throw new ConflictException('Dependency already exists');
      return dep;
    });
  }

  // ---- hydration ---------------------------------------------------------------

  private async hydrate(db: Db, taskId: string) {
    const [task] = await this.hydrateMany(db, [taskId]);
    return task ?? null;
  }

  private async hydrateMany(db: Db, taskIds: string[]) {
    const tasks = await db
      .select()
      .from(schema.tasks)
      .where(inArray(schema.tasks.id, taskIds));
    if (tasks.length === 0) return [];

    const [statusRows, typeRows, assigneeRows, locationRows, memberRows] = await Promise.all([
      db.select().from(schema.statuses).where(
        inArray(schema.statuses.id, [...new Set(tasks.map((t) => t.statusId))]),
      ),
      db.select().from(schema.itemTypes).where(
        inArray(schema.itemTypes.id, [...new Set(tasks.map((t) => t.itemTypeId))]),
      ),
      db.select().from(schema.taskAssignees).where(inArray(schema.taskAssignees.taskId, taskIds)),
      db.select().from(schema.taskLocations).where(inArray(schema.taskLocations.taskId, taskIds)),
      db.select().from(schema.memberships),
    ]);
    const projectRows = await db
      .select({ id: schema.projects.id, key: schema.projects.key })
      .from(schema.projects)
      .where(inArray(schema.projects.id, [...new Set(locationRows.map((l) => l.projectId))]));

    const statusById = new Map(statusRows.map((s) => [s.id, s]));
    const typeById = new Map(typeRows.map((t) => [t.id, t]));
    const projectById = new Map(projectRows.map((p) => [p.id, p]));
    const memberById = new Map(memberRows.map((m) => [m.id, m]));

    return tasks.map((t) => {
      const status = statusById.get(t.statusId)!;
      const locations = locationRows.filter((l) => l.taskId === t.id);
      const primary = locations.find((l) => l.isPrimary);
      const primaryProject = primary ? projectById.get(primary.projectId) : undefined;
      return {
        id: t.id,
        humanId:
          primaryProject && t.taskNumber != null ? `${primaryProject.key}-${t.taskNumber}` : null,
        title: t.title,
        description: t.description,
        itemKind: typeById.get(t.itemTypeId)?.baseKind ?? 'task',
        status: {
          id: status.id,
          name: status.name,
          color: status.color,
          canonicalGroup: status.canonicalGroup,
        },
        approvalStatus: t.approvalStatus,
        priority: t.priority,
        estimateMinutes: t.estimateMinutes,
        startDate: t.startDate,
        dueDate: t.dueDate,
        parentTaskId: t.parentTaskId,
        completedAt: t.completedAt?.toISOString() ?? null,
        assignees: assigneeRows
          .filter((a) => a.taskId === t.id)
          .map((a) => {
            const m = memberById.get(a.membershipId);
            return { membershipId: a.membershipId, displayName: m?.displayName ?? '' };
          }),
        locations: locations.map((l) => ({
          projectId: l.projectId,
          sectionId: l.sectionId,
          isPrimary: l.isPrimary,
        })),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      };
    });
  }
}
