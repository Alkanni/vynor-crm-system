import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ChannelsModule } from './channels/channels.module.js';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware.js';
import { ConfigModule } from './config/config.module.js';
import { ConversationsModule } from './conversations/conversations.module.js';
import { HealthModule } from './health/health.module.js';
import { IamModule } from './iam/index.js';
import { OpenApiModule } from './openapi/openapi.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { StorageModule } from './storage/storage.module.js';
import { WebchatModule } from './webchat/webchat.module.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';

@Module({
  imports: [
    ConfigModule,
    IamModule,
    HealthModule,
    AuditModule,
    StorageModule,
    RealtimeModule,
    OpenApiModule,
    AuthModule,
    ChannelsModule,
    WebhooksModule,
    WebchatModule,
    ConversationsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
