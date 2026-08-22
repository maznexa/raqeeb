import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateWebhookInput, WebhookDto } from '@raqeeb/contracts';
import { schema, withTenant } from '@raqeeb/db';
import { asc, eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import type { TenantContext } from '../auth/decorators';
import { AuditService } from './audit.service';

type WebhookRow = typeof schema.webhooks.$inferSelect;

/**
 * Public webhook subscriptions (docs/05-api-design/04-webhooks.md).
 * The signing secret is returned exactly once at creation and never again —
 * list/inspect expose health (status, failureCount, lastSuccessAt) instead.
 * Delivery itself lives in apps/worker/src/webhook-delivery.ts.
 */
@Injectable()
export class WebhooksService {
  constructor(private readonly audit: AuditService) {}

  private assertManager(ctx: TenantContext): void {
    if (ctx.role !== 'owner' && ctx.role !== 'admin') {
      throw new ForbiddenException('Only owners and admins can manage webhooks');
    }
  }

  async create(
    ctx: TenantContext,
    input: CreateWebhookInput,
  ): Promise<WebhookDto & { secret: string }> {
    this.assertManager(ctx);
    const secret = `whsec_raq_${randomBytes(32).toString('base64url')}`;
    return withTenant(ctx.tenantId, async (db) => {
      const [row] = await db
        .insert(schema.webhooks)
        .values({
          tenantId: ctx.tenantId,
          createdByMembershipId: ctx.membershipId,
          url: input.url,
          secret,
          events: input.events,
        })
        .returning();

      await this.audit.logIn(db, ctx.tenantId, {
        action: 'webhook.create',
        entityType: 'webhook',
        entityId: row!.id,
        actorMembershipId: ctx.membershipId,
        metadata: { url: input.url, events: input.events },
      });
      return { ...this.toDto(row!), secret }; // secret shown once
    });
  }

  async list(ctx: TenantContext): Promise<WebhookDto[]> {
    return withTenant(ctx.tenantId, async (db) => {
      const rows = await db
        .select()
        .from(schema.webhooks)
        .orderBy(asc(schema.webhooks.createdAt));
      return rows.map((r) => this.toDto(r));
    });
  }

  async remove(ctx: TenantContext, id: string): Promise<{ deleted: true }> {
    this.assertManager(ctx);
    return withTenant(ctx.tenantId, async (db) => {
      const [row] = await db
        .delete(schema.webhooks)
        .where(eq(schema.webhooks.id, id))
        .returning({ id: schema.webhooks.id });
      if (!row) throw new NotFoundException('Webhook not found');

      await this.audit.logIn(db, ctx.tenantId, {
        action: 'webhook.delete',
        entityType: 'webhook',
        entityId: id,
        actorMembershipId: ctx.membershipId,
      });
      return { deleted: true };
    });
  }

  /** Re-enable a suspended subscription; delivery resumes from NEW events only. */
  async reactivate(ctx: TenantContext, id: string): Promise<WebhookDto> {
    return withTenant(ctx.tenantId, async (db) => {
      const [row] = await db
        .update(schema.webhooks)
        .set({ status: 'active', failureCount: 0 })
        .where(eq(schema.webhooks.id, id))
        .returning();
      if (!row) throw new NotFoundException('Webhook not found');

      await this.audit.logIn(db, ctx.tenantId, {
        action: 'webhook.reactivate',
        entityType: 'webhook',
        entityId: id,
        actorMembershipId: ctx.membershipId,
      });
      return this.toDto(row);
    });
  }

  private toDto(row: WebhookRow): WebhookDto {
    return {
      id: row.id,
      url: row.url,
      events: row.events as string[],
      status: row.status as WebhookDto['status'],
      failureCount: row.failureCount,
      lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
