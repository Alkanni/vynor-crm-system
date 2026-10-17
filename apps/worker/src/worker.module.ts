import { Module } from '@nestjs/common';
import { ChannelHealthRecorder } from './channels/channel-health.service.js';
import { WorkerChannelRuntime } from './channels/channel-runtime.service.js';
import { ConfigModule } from './config/config.module.js';
import { ConversationIngestService } from './conversations/conversation-ingest.service.js';
import { WorkerHeartbeatService } from './health/worker-heartbeat.service.js';
import { OutboxModule } from './outbox/outbox.module.js';
import { ChannelPollingService } from './polling/channel-polling.service.js';
import { InboundProcessorService } from './processing/inbound-processor.service.js';
import { OutboundDispatcherService } from './processing/outbound-dispatcher.service.js';
import { QueueModule } from './queue/queue.module.js';

@Module({
  imports: [ConfigModule, QueueModule, OutboxModule],
  providers: [
    WorkerChannelRuntime,
    ChannelHealthRecorder,
    ConversationIngestService,
    InboundProcessorService,
    OutboundDispatcherService,
    ChannelPollingService,
    WorkerHeartbeatService,
  ],
})
export class WorkerModule {}
