import { Module } from '@nestjs/common';
import { OutboxModule } from './outbox/outbox.module.js';
import { QueueModule } from './queue/queue.module.js';

@Module({
  imports: [QueueModule, OutboxModule],
})
export class WorkerModule {}
