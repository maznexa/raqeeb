import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CommentDto, CreateCommentInput, UpdateCommentInput } from '@raqeeb/contracts';
import { schema, withTenant, type Db } from '@raqeeb/db';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { TenantContext } from '../auth/decorators';
import { AuditService } from '../platform/audit.service';
import { OutboxService } from '../platform/outbox.service';

type CommentRow = typeof schema.comments.$inferSelect;

/**
 * Task comments (collab slice). Edits are allowed indefinitely (anti-Wrike pledge)
 * and surfaced via the `edited` flag; deletes are soft so the activity stream stays
 * honest. All access runs inside withTenant() — RLS scopes every statement.
 */
@Injectable()
export class CommentsService {
  constructor(
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  async list(ctx: TenantContext, taskId: string): Promise<CommentDto[]> {
    return withTenant(ctx.tenantId, async (db) => {
      await this.requireTask(db, taskId);
      const rows = await db
        .select({ comment: schema.comments, displayName: schema.memberships.displayName })
        .from(schema.comments)
        .leftJoin(schema.memberships, eq(schema.memberships.id, schema.comments.authorMembershipId))
        .where(and(eq(schema.comments.taskId, taskId), isNull(schema.comments.deletedAt)))
        .orderBy(asc(schema.comments.createdAt));
      return rows.map((r) => this.toDto(r.comment, r.displayName));
    });
  }

  async create(ctx: TenantContext, taskId: string, input: CreateCommentInput): Promise<CommentDto> {
    return withTenant(ctx.tenantId, async (db) => {
      await this.requireTask(db, taskId);

      const [comment] = await db
        .insert(schema.comments)
        .values({
          tenantId: ctx.tenantId,
          taskId,
          authorMembershipId: ctx.membershipId,
          body: input.body,
        })
        .returning();

      await this.outbox.emit(db, ctx.tenantId, {
        eventType: 'comment.created',
        entityType: 'comment',
        entityId: comment!.id,
        payload: { taskId, authorMembershipId: ctx.membershipId },
      });
      await this.audit.logIn(db, ctx.tenantId, {
        action: 'comment.create',
        entityType: 'comment',
        entityId: comment!.id,
        actorMembershipId: ctx.membershipId,
      });

      return this.toDto(comment!, await this.authorName(db, ctx.membershipId));
    });
  }

  async update(ctx: TenantContext, commentId: string, input: UpdateCommentInput): Promise<CommentDto> {
    return withTenant(ctx.tenantId, async (db) => {
      const existing = await this.requireComment(db, commentId);
      if (existing.authorMembershipId !== ctx.membershipId) {
        throw new ForbiddenException('Only the author can edit a comment');
      }

      const [updated] = await db
        .update(schema.comments)
        .set({ body: input.body, updatedAt: new Date() })
        .where(eq(schema.comments.id, commentId))
        .returning();

      await this.audit.logIn(db, ctx.tenantId, {
        action: 'comment.update',
        entityType: 'comment',
        entityId: commentId,
        actorMembershipId: ctx.membershipId,
      });

      return this.toDto(updated!, await this.authorName(db, ctx.membershipId));
    });
  }

  /** Author may delete their own comment; owner/admin may moderate any. */
  async remove(ctx: TenantContext, commentId: string): Promise<{ deleted: true }> {
    return withTenant(ctx.tenantId, async (db) => {
      const existing = await this.requireComment(db, commentId);
      const canModerate = ctx.role === 'owner' || ctx.role === 'admin';
      if (existing.authorMembershipId !== ctx.membershipId && !canModerate) {
        throw new ForbiddenException('Only the author or a workspace admin can delete a comment');
      }

      await db
        .update(schema.comments)
        .set({ deletedAt: new Date() })
        .where(eq(schema.comments.id, commentId));

      await this.audit.logIn(db, ctx.tenantId, {
        action: 'comment.delete',
        entityType: 'comment',
        entityId: commentId,
        actorMembershipId: ctx.membershipId,
        metadata: { taskId: existing.taskId, authorMembershipId: existing.authorMembershipId },
      });

      return { deleted: true as const };
    });
  }

  // ---- helpers ---------------------------------------------------------------

  /** RLS hides foreign rows; surface the invisible container as 404, not empty 200. */
  private async requireTask(db: Db, taskId: string): Promise<void> {
    const task = await db.query.tasks.findFirst({
      where: eq(schema.tasks.id, taskId),
      columns: { id: true },
    });
    if (!task) throw new NotFoundException('Task not found');
  }

  private async requireComment(db: Db, commentId: string): Promise<CommentRow> {
    const comment = await db.query.comments.findFirst({
      where: and(eq(schema.comments.id, commentId), isNull(schema.comments.deletedAt)),
    });
    if (!comment) throw new NotFoundException('Comment not found');
    return comment;
  }

  private async authorName(db: Db, membershipId: string): Promise<string> {
    const m = await db.query.memberships.findFirst({
      where: eq(schema.memberships.id, membershipId),
      columns: { displayName: true },
    });
    return m?.displayName ?? '';
  }

  private toDto(row: CommentRow, displayName: string | null | undefined): CommentDto {
    return {
      id: row.id,
      taskId: row.taskId,
      author: { membershipId: row.authorMembershipId, displayName: displayName ?? '' },
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      edited: row.updatedAt.getTime() > row.createdAt.getTime(),
    };
  }
}
