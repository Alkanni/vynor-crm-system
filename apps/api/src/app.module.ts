import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { AuditModule } from './audit/audit.module.js';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware.js';
import { HealthModule } from './health/health.module.js';
import { IamModule } from './iam/index.js';

@Module({
  imports: [IamModule, HealthModule, AuditModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
