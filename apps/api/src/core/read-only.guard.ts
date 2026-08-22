import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { TenantContext } from '../auth/decorators';
import { TenantStateService } from './tenant-state.service';

/**
 * past_due keeps billing recovery and authentication working — data is never
 * hostage (docs/06-saas-commercial/03-billing-stripe.md): reads, export, and
 * the path back to `active` all survive every billing state.
 */
const EXEMPT_PREFIXES = ['/api/v1/billing', '/api/v1/auth'];
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Dunning read-only mode (global guard, after AuthGuard): while a tenant is
 * past_due every read keeps working and every write is rejected, except the
 * routes a customer needs to fix payment or re-authenticate.
 */
@Injectable()
export class ReadOnlyGuard implements CanActivate {
  constructor(private readonly tenantState: TenantStateService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { tenantContext?: TenantContext }>();

    if (SAFE_METHODS.has(req.method)) return true;
    const tenant = req.tenantContext;
    if (!tenant) return true; // no tenant in play — nothing to freeze

    const path = req.path ?? '';
    if (EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;

    const state = await this.tenantState.get(tenant.tenantId);
    if (state?.subscriptionStatus !== 'past_due') return true;

    throw new ForbiddenException({
      title: 'Workspace is read-only',
      detail:
        'This workspace is past due on its subscription, so writes are paused. ' +
        'Update the payment method under Billing to restore full access — ' +
        'your data stays readable and exportable the whole time.',
    });
  }
}
