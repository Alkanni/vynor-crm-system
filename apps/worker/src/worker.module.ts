import { Module } from '@nestjs/common';
import { ChannelHealthRecorder } from './channels/channel-health.service.js';
import { WorkerChannelRuntime } from './channels/channel-runtime.service.js';
import { WORKER_ENV, getWorkerEnv } from './config/worker-env.js';
import { ConversationIngestService } from './conversations/conversation-ingest.service.js';
import { OutboxModule } from './outbox/outbox.module.js';
import { ChannelPollingService } from './polling/channel-polling.service.js';
import { InboundProcessorService } from './processing/inbound-processor.service.js';
import { OutboundDispatcherService } from './processing/outbound-dispatcher.service.js';
import { QueueModule } from './queue/queue.module.js';

@Module({
  imports: [QueueModule, OutboxModule],
  providers: [
    { provide: WORKER_ENV, useFactory: getWorkerEnv },
    WorkerChannelRuntime,
    ChannelHealthRecorder,
    ConversationIngestService,
    InboundProcessorService,
    OutboundDispatcherService,
    ChannelPollingService,
  ],
})
export class WorkerModule {}
