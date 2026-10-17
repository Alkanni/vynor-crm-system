import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { QUEUE_NAMES, WorkerEnvSchema } from '@vynor/contracts';
import { createTestPrismaClient } from '@vynor/database';
import { PgBoss } from 'pg-boss';
import { PgBossService } from '../src/queue/pg-boss.service.js';

/**
 * A failed pg-boss start must be retried in-process, and handlers registered while pg-boss was
 * down must subscribe once it starts. Runs the real pg-boss against the test database, in its
 * own schema, which is dropped afterwards. A failed start is simulated by rejecting `start()`.
 */

const SCHEMA = 'pgboss_start_retry_test';
const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const env = WorkerEnvSchema.parse({
  APP_ENV: 'test',
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
  DIRECT_URL: databaseUrl,
  PG_BOSS_SCHEMA: SCHEMA,
  STORAGE_ACCESS_KEY_ID: 'key',
  STORAGE_SECRET_ACCESS_KEY: 'secret',
});

const services: PgBossService[] = [];

function newService(): PgBossService {
  const service = new PgBossService(env);
  services.push(service);
  return service;
}

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await Promise.all(services.splice(0).map((service) => service.onModuleDestroy()));
});

afterAll(async () => {
  const db = createTestPrismaClient();
  await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
  await db.$disconnect();
});

describe('PgBossService start retry', () => {
  it('waits 5 s before the first retry, doubling up to 60 s', () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => PgBossService.startRetryDelayMs(n))).toEqual([
      5_000, 10_000, 20_000, 40_000, 60_000, 60_000,
    ]);
  });

  it('retries a failed start, then runs a handler registered while pg-boss was down', async () => {
    vi.spyOn(PgBoss.prototype, 'start').mockRejectedValueOnce(new Error('connection refused'));
    vi.spyOn(PgBossService, 'startRetryDelayMs').mockReturnValue(50);
    const service = newService();

    await service.onModuleInit();
    expect(service.isRunning()).toBe(false);

    const handled: unknown[] = [];
    const registered = service.work(
      QUEUE_NAMES.WEBHOOKS_PROCESS,
      async (job) => {
        handled.push(job.data);
      },
      { pollingIntervalSeconds: 0.5 },
    );
    await expect(registered).resolves.toBe(false);

    await vi.waitFor(() => expect(service.isRunning()).toBe(true), { timeout: 10_000 });
    await service.sendJob(QUEUE_NAMES.WEBHOOKS_PROCESS, { providerEventId: 'retry-test' });
    await vi.waitFor(() => expect(handled).toEqual([{ providerEventId: 'retry-test' }]), {
      timeout: 10_000,
    });
  }, 30_000);

  it('stops retrying once the module is destroyed', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const start = vi
      .spyOn(PgBoss.prototype, 'start')
      .mockRejectedValue(new Error('connection refused'));
    const service = newService();

    await service.onModuleInit();
    await vi.advanceTimersByTimeAsync(PgBossService.startRetryDelayMs(1));
    expect(start).toHaveBeenCalledTimes(2);

    await service.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(10 * PgBossService.startRetryDelayMs(10));
    expect(start).toHaveBeenCalledTimes(2);
    expect(service.isRunning()).toBe(false);
  });

  it('stops an instance whose start finishes after the module was destroyed', async () => {
    const realStart = PgBoss.prototype.start;
    let releaseStart!: () => void;
    const startReleased = new Promise<void>((resolve) => (releaseStart = resolve));
    const start = vi
      .spyOn(PgBoss.prototype, 'start')
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockImplementationOnce(async function (this: PgBoss) {
        await startReleased;
        return realStart.call(this);
      });
    const stop = vi.spyOn(PgBoss.prototype, 'stop');
    vi.spyOn(PgBossService, 'startRetryDelayMs').mockReturnValue(0);
    const service = newService();

    await service.onModuleInit();
    await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(2));
    await service.onModuleDestroy();
    releaseStart();

    // The failed first instance is stopped, then the late one once its start finishes.
    await vi.waitFor(() => expect(stop).toHaveBeenCalledTimes(2), { timeout: 10_000 });
    expect(stop.mock.contexts[1]).toBe(start.mock.contexts[1]);
    await stop.mock.results[1]?.value;
    expect(service.isRunning()).toBe(false);
  }, 30_000);
});
