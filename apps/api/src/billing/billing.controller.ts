import { Body, Controller, Get, Post } from '@nestjs/common';
import { startCheckoutSchema, type StartCheckoutInput } from '@raqeeb/contracts';
import { Tenant, type TenantContext } from '../auth/decorators';
import { ZodValidationPipe } from '../core/zod.pipe';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  /** Owner/admin only (enforced in the service). */
  @Post('checkout')
  startCheckout(
    @Tenant() ctx: TenantContext,
    @Body(new ZodValidationPipe(startCheckoutSchema)) body: StartCheckoutInput,
  ) {
    return this.billing.startCheckout(ctx, body);
  }

  /** Owner/admin only (enforced in the service). */
  @Post('portal')
  portal(@Tenant() ctx: TenantContext) {
    return this.billing.portal(ctx);
  }

  @Get('status')
  status(@Tenant() ctx: TenantContext) {
    return this.billing.status(ctx);
  }
}
