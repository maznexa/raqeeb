import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { BillingStatusDto, StartCheckoutInput } from '@raqeeb/contracts';
import { schema, systemDb } from '@raqeeb/db';
import { eq } from 'drizzle-orm';
import type { TenantContext } from '../auth/decorators';
import { AuditService } from '../platform/audit.service';
import { priceFor } from './prices';
import { countBillableSeats } from './seats';
import { STRIPE_DRIVER, type StripeDriver } from './stripe.driver';

function webOrigin(): string {
  return process.env.WEB_ORIGIN ?? 'http://localhost:3000';
}

/**
 * Checkout/Portal/status facade over the Stripe driver. Tenant billing columns
 * are read via systemDb — billing is a documented cross-tenant system path
 * (packages/db/src/client.ts); no tenant-scoped business data is touched here.
 */
@Injectable()
export class BillingService {
  constructor(
    @Inject(STRIPE_DRIVER) private readonly driver: StripeDriver,
    private readonly audit: AuditService,
  ) {}

  private assertBillingAdmin(ctx: TenantContext): void {
    if (ctx.role !== 'owner' && ctx.role !== 'admin') {
      throw new ForbiddenException('Only owners and admins can manage billing');
    }
  }

  private async tenantOrThrow(tenantId: string) {
    const tenant = await systemDb().query.tenants.findFirst({
      where: eq(schema.tenants.id, tenantId),
    });
    if (!tenant) throw new NotFoundException('Workspace not found');
    return tenant;
  }

  async startCheckout(ctx: TenantContext, input: StartCheckoutInput): Promise<{ url: string }> {
    this.assertBillingAdmin(ctx);
    const tenant = await this.tenantOrThrow(ctx.tenantId);
    const seats = await countBillableSeats(ctx.tenantId);

    const session = await this.driver.createCheckoutSession({
      tenantId: ctx.tenantId,
      planId: input.planId,
      priceId: priceFor(input.planId, input.interval),
      // Exact count, no seat minimums (D9) — but a subscription needs ≥1 item.
      quantity: Math.max(1, seats),
      customerId: tenant.stripeCustomerId,
      successUrl: `${webOrigin()}/settings/billing?checkout=success`,
      cancelUrl: `${webOrigin()}/settings/billing?checkout=canceled`,
    });

    this.audit.log(ctx.tenantId, {
      action: 'billing.checkout_started',
      entityType: 'tenant',
      entityId: ctx.tenantId,
      actorMembershipId: ctx.membershipId,
      metadata: { planId: input.planId, interval: input.interval },
    });
    return { url: session.url };
  }

  async portal(ctx: TenantContext): Promise<{ url: string }> {
    this.assertBillingAdmin(ctx);
    const tenant = await this.tenantOrThrow(ctx.tenantId);
    if (!tenant.stripeCustomerId) {
      throw new BadRequestException(
        'This workspace has no billing account yet — start a subscription first',
      );
    }
    return this.driver.createPortalSession({
      customerId: tenant.stripeCustomerId,
      returnUrl: `${webOrigin()}/settings/billing`,
    });
  }

  async status(ctx: TenantContext): Promise<BillingStatusDto> {
    const tenant = await this.tenantOrThrow(ctx.tenantId);
    const billableSeats = await countBillableSeats(ctx.tenantId);
    return {
      planId: tenant.planId,
      subscriptionStatus: tenant.subscriptionStatus,
      trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
      billableSeats,
      // past_due = read-only, never hostage (docs/06-saas-commercial/03-billing-stripe.md)
      readOnly: tenant.subscriptionStatus === 'past_due',
    };
  }
}
