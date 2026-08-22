import { hash, verify } from '@node-rs/argon2';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthTokens, LoginInput, SignupInput } from '@raqeeb/contracts';
import { schema, systemDb } from '@raqeeb/db';
import { and, eq, isNull } from 'drizzle-orm';
import { createHash, randomUUID } from 'node:crypto';
import { env } from '../core/env';
import { TenantsService } from '../tenants/tenants.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly tenants: TenantsService,
  ) {}

  async signup(input: SignupInput) {
    const db = systemDb();
    const existing = await db.query.accounts.findFirst({
      where: eq(schema.accounts.email, input.email.toLowerCase()),
    });
    if (existing) throw new ConflictException('An account with this email already exists');

    const [account] = await db
      .insert(schema.accounts)
      .values({
        email: input.email.toLowerCase(),
        passwordHash: await hash(input.password),
        displayName: input.displayName,
        locale: input.locale,
      })
      .returning();

    let tenant = null;
    if (input.tenantName) {
      tenant = await this.tenants.provision(account!.id, {
        name: input.tenantName,
        defaultLocale: input.locale,
      });
    }

    const tokens = await this.issueTokens(account!.id);
    return {
      account: { id: account!.id, email: account!.email, displayName: account!.displayName },
      tenant,
      ...tokens,
    };
  }

  async login(input: LoginInput) {
    const db = systemDb();
    const account = await db.query.accounts.findFirst({
      where: eq(schema.accounts.email, input.email.toLowerCase()),
    });
    if (!account?.passwordHash || !(await verify(account.passwordHash, input.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const tokens = await this.issueTokens(account.id);
    return {
      account: { id: account.id, email: account.email, displayName: account.displayName },
      ...tokens,
    };
  }

  /** Refresh-token rotation: verify JWT, check stored jti not revoked, revoke, reissue. */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: { sub: string; jti: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret: env().JWT_REFRESH_SECRET });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const db = systemDb();
    const tokenHash = createHash('sha256').update(payload.jti).digest('hex');
    const stored = await db.query.refreshTokens.findFirst({
      where: and(eq(schema.refreshTokens.tokenHash, tokenHash), isNull(schema.refreshTokens.revokedAt)),
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token revoked or expired');
    }
    await db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(schema.refreshTokens.id, stored.id));
    return this.issueTokens(payload.sub);
  }

  private async issueTokens(accountId: string): Promise<AuthTokens> {
    const e = env();
    const jti = randomUUID();
    const accessToken = await this.jwt.signAsync(
      { sub: accountId },
      { secret: e.JWT_ACCESS_SECRET, expiresIn: e.JWT_ACCESS_TTL },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: accountId, jti },
      { secret: e.JWT_REFRESH_SECRET, expiresIn: e.JWT_REFRESH_TTL },
    );
    await systemDb()
      .insert(schema.refreshTokens)
      .values({
        accountId,
        tokenHash: createHash('sha256').update(jti).digest('hex'),
        expiresAt: new Date(Date.now() + e.JWT_REFRESH_TTL * 1000),
      });
    return { accessToken, refreshToken };
  }
}
