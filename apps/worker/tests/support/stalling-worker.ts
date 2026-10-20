/**
 * A worker process that takes one job from the webhooks queue and never finishes it, so a spec
 * can kill it mid-job (bullmq-fault-injection.integration.spec.ts). Prints `ACTIVE <jobId>`
 * once the job is active. Short locks, so the job counts as stalled a second after the kill.
 *
 * Usage: TEST_REDIS_URL=… node --import tsx stalling-worker.ts
 */
import { QUEUE_NAMES } from '@vynor/contracts';
import { BullMqJobQueue } from '../../src/queue/bullmq-job-queue.js';
import { testRedisUrl, testWorkerEnv } from './test-redis.js';

const queue = new BullMqJobQueue(testWorkerEnv({ REDIS_URL: testRedisUrl() }), {
  lockDurationMs: 1_000,
  stalledIntervalMs: 500,
});
await queue.onModuleInit();
await queue.work(QUEUE_NAMES.WEBHOOKS_PROCESS, async (job) => {
  process.stdout.write(`ACTIVE ${job.id}\n`);
  await new Promise<never>(() => {});
});
