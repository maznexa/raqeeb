import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  createCommentSchema,
  updateCommentSchema,
  type CreateCommentInput,
  type UpdateCommentInput,
} from '@raqeeb/contracts';
import { Tenant, type TenantContext } from '../auth/decorators';
import { ZodValidationPipe } from '../core/zod.pipe';
import { CommentsService } from './comments.service';

@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('tasks/:taskId/comments')
  list(@Tenant() ctx: TenantContext, @Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.comments.list(ctx, taskId);
  }

  @Post('tasks/:taskId/comments')
  create(
    @Tenant() ctx: TenantContext,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body(new ZodValidationPipe(createCommentSchema)) body: CreateCommentInput,
  ) {
    return this.comments.create(ctx, taskId, body);
  }

  @Patch('comments/:id')
  update(
    @Tenant() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateCommentSchema)) body: UpdateCommentInput,
  ) {
    return this.comments.update(ctx, id, body);
  }

  @Delete('comments/:id')
  remove(@Tenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.comments.remove(ctx, id);
  }
}
