import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { createWebhookSchema, type CreateWebhookInput } from '@raqeeb/contracts';
import { Tenant, type TenantContext } from '../auth/decorators';
import { ZodValidationPipe } from '../core/zod.pipe';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post()
  create(
    @Tenant() ctx: TenantContext,
    @Body(new ZodValidationPipe(createWebhookSchema)) body: CreateWebhookInput,
  ) {
    return this.webhooks.create(ctx, body);
  }

  @Get()
  list(@Tenant() ctx: TenantContext) {
    return this.webhooks.list(ctx);
  }

  @Delete(':id')
  remove(@Tenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.webhooks.remove(ctx, id);
  }

  @Post(':id/reactivate')
  reactivate(@Tenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.webhooks.reactivate(ctx, id);
  }
}
