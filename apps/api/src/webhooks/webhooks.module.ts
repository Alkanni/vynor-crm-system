import { Module } from '@nestjs/common';
import { WebhookIngestService } from './webhook-ingest.service.js';
import { WebhooksController } from './webhooks.controller.js';

@Module({
  controllers: [WebhooksController],
  providers: [WebhookIngestService],
  exports: [WebhookIngestService],
})
export class WebhooksModule {}
