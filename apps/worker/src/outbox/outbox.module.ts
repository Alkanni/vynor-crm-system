import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module.js';
import { OutboxDispatcherService } from './outbox-dispatcher.service.js';

@Module({
  imports: [QueueModule],
  providers: [OutboxDispatcherService],
  exports: [OutboxDispatcherService],
})
export class OutboxModule {}
