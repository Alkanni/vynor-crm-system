import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway.js';
import { RealtimePublisherService } from './realtime-publisher.service.js';

@Module({
  providers: [RealtimeGateway, RealtimePublisherService],
  exports: [RealtimeGateway, RealtimePublisherService],
})
export class RealtimeModule {}
