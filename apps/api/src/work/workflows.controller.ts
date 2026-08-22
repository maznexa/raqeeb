import { Body, Controller, Get, Post } from '@nestjs/common';
import { createWorkflowSchema, type CreateWorkflowInput } from '@raqeeb/contracts';
import { schema, withTenant } from '@raqeeb/db';
import { asc, eq } from 'drizzle-orm';
import { generateKeyBetween } from 'fractional-indexing';
import { Tenant, type TenantContext } from '../auth/decorators';
import { ZodValidationPipe } from '../core/zod.pipe';

@Controller('workflows')
export class WorkflowsController {
  @Get()
  list(@Tenant() ctx: TenantContext) {
    return withTenant(ctx.tenantId, async (db) => {
      const workflows = await db.select().from(schema.workflows);
      const statuses = await db
        .select()
        .from(schema.statuses)
        .orderBy(asc(schema.statuses.position));
      return workflows.map((w) => ({
        ...w,
        statuses: statuses.filter((s) => s.workflowId === w.id),
      }));
    });
  }

  @Post()
  create(
    @Tenant() ctx: TenantContext,
    @Body(new ZodValidationPipe(createWorkflowSchema)) body: CreateWorkflowInput,
  ) {
    return withTenant(ctx.tenantId, async (db) => {
      const [workflow] = await db
        .insert(schema.workflows)
        .values({ tenantId: ctx.tenantId, name: body.name })
        .returning();
      let pos: string | null = null;
      const created = [];
      for (const s of body.statuses) {
        pos = generateKeyBetween(pos, null);
        const [row] = await db
          .insert(schema.statuses)
          .values({ tenantId: ctx.tenantId, workflowId: workflow!.id, position: pos, ...s })
          .returning();
        created.push(row!);
      }
      return { ...workflow!, statuses: created };
    });
  }

  @Get('item-types')
  itemTypes(@Tenant() ctx: TenantContext) {
    return withTenant(ctx.tenantId, (db) =>
      db.select().from(schema.itemTypes).orderBy(asc(schema.itemTypes.name)),
    );
  }

  @Get('default')
  defaultWorkflow(@Tenant() ctx: TenantContext) {
    return withTenant(ctx.tenantId, async (db) => {
      const wf = await db.query.workflows.findFirst({
        where: eq(schema.workflows.isDefault, true),
      });
      if (!wf) return null;
      const statuses = await db
        .select()
        .from(schema.statuses)
        .where(eq(schema.statuses.workflowId, wf.id))
        .orderBy(asc(schema.statuses.position));
      return { ...wf, statuses };
    });
  }
}
