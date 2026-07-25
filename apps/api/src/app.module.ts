import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import type { Request } from 'express';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { OutboxModule } from './outbox/outbox.module';
import { AuthModule } from './auth/auth.module';
import { TenantModule } from './tenant/tenant.module';
import { BranchModule } from './branch/branch.module';
import { WarehouseModule } from './warehouse/warehouse.module';
import { MemberModule } from './member/member.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthModule } from './health/health.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { AccessGuard } from './access/access.guard';
import { GlobalExceptionFilter } from './common/http-exception.filter';
import { correlationIdMiddleware } from './common/correlation-id.middleware';
import { envConfig } from './config/env';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: envConfig().logLevel,
        genReqId: (req) => (req as Request).correlationId ?? 'unknown',
        customProps: (req) => ({ correlationId: (req as Request).correlationId }),
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        transport: envConfig().nodeEnv === 'development' ? { target: 'pino-pretty' } : undefined,
      },
    }),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 120 }] }),
    JwtModule.register({ global: true }),
    PrismaModule,
    AuditModule,
    OutboxModule,
    AuthModule,
    TenantModule,
    BranchModule,
    WarehouseModule,
    MemberModule,
    DashboardModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    // Urutan guard penting: throttling → autentikasi → otorisasi (default deny).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(correlationIdMiddleware).forRoutes('*path');
  }
}
