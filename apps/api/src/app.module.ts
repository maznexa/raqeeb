import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { LoggerModule } from 'nestjs-pino';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import { HealthController } from './core/health.controller';
import { ProblemDetailsFilter } from './core/http-exception.filter';
import { EntitlementsService } from './entitlements/entitlements.service';
import { AuditService } from './platform/audit.service';
import { OutboxService } from './platform/outbox.service';
import { PatsController } from './platform/pats.controller';
import { TenantsController } from './tenants/tenants.controller';
import { TenantsService } from './tenants/tenants.service';
import { ProjectsController } from './work/projects.controller';
import { SpacesController } from './work/spaces.controller';
import { TasksController } from './work/tasks.controller';
import { TasksService } from './work/tasks.service';
import { WorkflowsController } from './work/workflows.controller';

/**
 * Modular monolith, one Nest module per bounded context arriving in later phases.
 * Scaffold keeps them colocated; the module boundaries are the split lines.
 */
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        redact: ['req.headers.authorization'],
        transport:
          process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
      },
    }),
    JwtModule.register({ global: true }),
  ],
  controllers: [
    HealthController,
    AuthController,
    TenantsController,
    SpacesController,
    WorkflowsController,
    ProjectsController,
    TasksController,
    PatsController,
  ],
  providers: [
    AuthService,
    TenantsService,
    EntitlementsService,
    TasksService,
    AuditService,
    OutboxService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
export class AppModule {}
