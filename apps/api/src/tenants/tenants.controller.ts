import { Body, Controller, ForbiddenException, Get, Post } from '@nestjs/common';
import {
  createTenantSchema,
  inviteMemberSchema,
  type CreateTenantInput,
  type InviteMemberInput,
} from '@raqeeb/contracts';
import { ZodValidationPipe } from '../core/zod.pipe';
import {
  CurrentPrincipal,
  Tenant,
  type Principal,
  type TenantContext,
} from '../auth/decorators';
import { TenantsService } from './tenants.service';

@Controller()
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Post('tenants')
  create(
    @CurrentPrincipal() principal: Principal,
    @Body(new ZodValidationPipe(createTenantSchema)) body: CreateTenantInput,
  ) {
    if (principal.kind !== 'user') {
      throw new ForbiddenException('Tenant creation requires a user session');
    }
    return this.tenants.provision(principal.accountId, body);
  }

  @Get('me/tenants')
  myTenants(@CurrentPrincipal() principal: Principal) {
    if (principal.kind !== 'user') throw new ForbiddenException('User session required');
    return this.tenants.myTenants(principal.accountId);
  }

  @Get('tenant')
  current(@Tenant() ctx: TenantContext) {
    return this.tenants.currentTenant(ctx);
  }

  @Get('tenant/members')
  members(@Tenant() ctx: TenantContext) {
    return this.tenants.members(ctx);
  }

  @Post('tenant/invitations')
  invite(
    @Tenant() ctx: TenantContext,
    @Body(new ZodValidationPipe(inviteMemberSchema)) body: InviteMemberInput,
  ) {
    if (!['owner', 'admin'].includes(ctx.role)) {
      throw new ForbiddenException('Only owners and admins can invite members');
    }
    return this.tenants.invite(ctx, body);
  }
}
