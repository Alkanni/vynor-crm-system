import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway.js';
import { RealtimePublisherService } from './realtime-publisher.service.js';
import { RealtimeRelayService } from './realtime-relay.service.js';

@Module({
  providers: [RealtimeGateway, RealtimePublisherService, RealtimeRelayService],
  exports: [RealtimeGateway, RealtimePublisherService],
})
export class RealtimeModule {}
