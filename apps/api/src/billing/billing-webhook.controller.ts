import {
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/decorators';
import { StripeWebhookService } from './stripe-webhook.service';

/**
 * Stripe calls this unauthenticated (@Public); trust comes from the signature
 * check against STRIPE_WEBHOOK_SECRET. Requires NestFactory.create(..., { rawBody: true })
 * in main.ts — signature verification needs the exact request bytes.
 */
@Public()
@Controller('billing/stripe')
export class BillingWebhookController {
  constructor(private readonly webhook: StripeWebhookService) {}

  @Post('webhook')
  @HttpCode(200) // Stripe treats non-2xx as delivery failure; duplicates must also 200
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    const event = this.webhook.parse(raw, signature);
    return this.webhook.handleEvent(event);
  }
}
