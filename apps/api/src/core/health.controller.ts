import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { getSystemPool } from '@raqeeb/db';
import Redis from 'ioredis';
import { env } from './env';
import { Public } from '../auth/decorators';

@Controller()
export class HealthController {
  private redis?: Redis;

  @Public()
  @Get('healthz')
  async healthz() {
    const checks: Record<string, 'ok' | 'fail'> = { postgres: 'fail', redis: 'fail' };
    try {
      await getSystemPool().query('SELECT 1');
      checks.postgres = 'ok';
    } catch {
      /* reported below */
    }
    try {
      this.redis ??= new Redis(env().REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
      if (this.redis.status === 'wait' || this.redis.status === 'end') await this.redis.connect();
      await this.redis.ping();
      checks.redis = 'ok';
    } catch {
      /* reported below */
    }
    const healthy = Object.values(checks).every((v) => v === 'ok');
    if (!healthy) throw new ServiceUnavailableException({ checks });
    return { status: 'ok', checks, uptimeSeconds: Math.round(process.uptime()) };
  }
}
