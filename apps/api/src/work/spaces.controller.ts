import { Body, Controller, Get, Post } from '@nestjs/common';
import { createSpaceSchema, type CreateSpaceInput } from '@raqeeb/contracts';
import { schema, withTenant } from '@raqeeb/db';
import { asc } from 'drizzle-orm';
import { generateKeyBetween } from 'fractional-indexing';
import { Tenant, type TenantContext } from '../auth/decorators';
import { ZodValidationPipe } from '../core/zod.pipe';
import { AuditService } from '../platform/audit.service';

@Controller('spaces')
export class SpacesController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Tenant() ctx: TenantContext) {
    return withTenant(ctx.tenantId, (db) =>
      db.select().from(schema.spaces).orderBy(asc(schema.spaces.position)),
    );
  }

  @Post()
  create(
    @Tenant() ctx: TenantContext,
    @Body(new ZodValidationPipe(createSpaceSchema)) body: CreateSpaceInput,
  ) {
    return withTenant(ctx.tenantId, async (db) => {
      const last = await db
        .select({ position: schema.spaces.position })
        .from(schema.spaces)
        .orderBy(asc(schema.spaces.position));
      const position = generateKeyBetween(last.at(-1)?.position ?? null, null);
      const [space] = await db
        .insert(schema.spaces)
        .values({ tenantId: ctx.tenantId, ...body, position })
        .returning();
      await this.audit.logIn(db, ctx.tenantId, {
        action: 'space.create',
        entityType: 'space',
        entityId: space!.id,
        actorMembershipId: ctx.membershipId,
      });
      return space;
    });
  }
}
