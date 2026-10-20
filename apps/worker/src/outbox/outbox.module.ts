import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module.js';
import { OutboxDispatcherService } from './outbox-dispatcher.service.js';
import { OutboxReconciliationService } from './outbox-reconciliation.service.js';

@Module({
  imports: [QueueModule],
  providers: [OutboxDispatcherService, OutboxReconciliationService],
  exports: [OutboxDispatcherService],
})
export class OutboxModule {}
