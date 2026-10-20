import { Global, Module } from '@nestjs/common';
import { BullMqJobQueue } from './bullmq-job-queue.js';
import { DrainingJobQueue } from './draining-job-queue.js';
import { JobQueue } from './job-queue.js';
import { PgBossDrainMonitor } from './pg-boss-drain-monitor.service.js';
import { PgBossService } from './pg-boss.service.js';

/**
 * Job transport (WU-05a expand): consumers inject JobQueue, which sends to BullMQ and drains
 * pg-boss. WU-05b binds JobQueue to BullMqJobQueue alone and drops pg-boss.
 */
@Global()
@Module({
  providers: [
    PgBossService,
    BullMqJobQueue,
    { provide: JobQueue, useClass: DrainingJobQueue },
    PgBossDrainMonitor,
  ],
  // BullMqJobQueue for the outbox reconciliation, which checks BullMQ jobs directly.
  exports: [JobQueue, BullMqJobQueue],
})
export class QueueModule {}
