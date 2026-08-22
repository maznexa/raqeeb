import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { env } from './core/env';

async function bootstrap() {
  const e = env(); // fail fast on invalid configuration
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: e.WEB_ORIGIN,
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Tenant-Id', 'X-Tenant-Slug'],
  });
  app.enableShutdownHooks();
  await app.listen(e.API_PORT);
  // eslint-disable-next-line no-console
  console.log(`Raqeeb API listening on :${e.API_PORT} (prefix /api/v1)`);
}

void bootstrap();
