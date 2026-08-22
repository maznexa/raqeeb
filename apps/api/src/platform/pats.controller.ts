import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { createPatSchema, type CreatePatInput } from '@raqeeb/contracts';
import { schema, withTenant } from '@raqeeb/db';
import { and, eq, isNull } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import { Tenant, type TenantContext } from '../auth/decorators';
import { ZodValidationPipe } from '../core/zod.pipe';

/**
 * Personal Access Tokens — the v1 public-API credential (raq_pat_*).
 * The full token is returned exactly once at creation; only its SHA-256 is stored.
 */
@Controller('me/pats')
export class PatsController {
  @Get()
  list(@Tenant() ctx: TenantContext) {
    return withTenant(ctx.tenantId, (db) =>
      db
        .select({
          id: schema.personalAccessTokens.id,
          name: schema.personalAccessTokens.name,
          tokenPrefix: schema.personalAccessTokens.tokenPrefix,
          lastUsedAt: schema.personalAccessTokens.lastUsedAt,
          expiresAt: schema.personalAccessTokens.expiresAt,
          createdAt: schema.personalAccessTokens.createdAt,
        })
        .from(schema.personalAccessTokens)
        .where(
          and(
            eq(schema.personalAccessTokens.membershipId, ctx.membershipId),
            isNull(schema.personalAccessTokens.revokedAt),
          ),
        ),
    );
  }

  @Post()
  create(
    @Tenant() ctx: TenantContext,
    @Body(new ZodValidationPipe(createPatSchema)) body: CreatePatInput,
  ) {
    const token = `raq_pat_${randomBytes(24).toString('base64url')}`;
    return withTenant(ctx.tenantId, async (db) => {
      const [row] = await db
        .insert(schema.personalAccessTokens)
        .values({
          tenantId: ctx.tenantId,
          membershipId: ctx.membershipId,
          name: body.name,
          tokenPrefix: token.slice(0, 16),
          tokenHash: createHash('sha256').update(token).digest('hex'),
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        })
        .returning();
      return { id: row!.id, name: row!.name, token }; // shown once
    });
  }

  @Delete(':id')
  revoke(@Tenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return withTenant(ctx.tenantId, async (db) => {
      await db
        .update(schema.personalAccessTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(schema.personalAccessTokens.id, id),
            eq(schema.personalAccessTokens.membershipId, ctx.membershipId),
          ),
        );
      return { revoked: true };
    });
  }
}
