import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  loginSchema,
  refreshSchema,
  signupSchema,
  type LoginInput,
  type RefreshInput,
  type SignupInput,
} from '@raqeeb/contracts';
import { schema, systemDb } from '@raqeeb/db';
import { eq } from 'drizzle-orm';
import { ZodValidationPipe } from '../core/zod.pipe';
import { CurrentPrincipal, Public, type Principal } from './decorators';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('signup')
  signup(@Body(new ZodValidationPipe(signupSchema)) body: SignupInput) {
    return this.auth.signup(body);
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput) {
    return this.auth.login(body);
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body(new ZodValidationPipe(refreshSchema)) body: RefreshInput) {
    return this.auth.refresh(body.refreshToken);
  }

  @Get('me')
  async me(@CurrentPrincipal() principal: Principal) {
    if (principal.kind === 'pat') {
      return { kind: 'pat', tenantId: principal.tenantId };
    }
    const account = await systemDb().query.accounts.findFirst({
      where: eq(schema.accounts.id, principal.accountId),
      columns: { id: true, email: true, displayName: true, locale: true, timezone: true },
    });
    return { kind: 'user', account };
  }
}
