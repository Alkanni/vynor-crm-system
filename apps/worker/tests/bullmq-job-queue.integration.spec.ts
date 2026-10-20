import { setTimeout as sleep } from 'node:timers/promises';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { QUEUE_NAMES, type QueueName } from '@vynor/contracts';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import {
  BULLMQ_PREFIX,
  BullMqJobQueue,
  jobOptionsFor,
  type BullMqTimings,
} from '../src/queue/bullmq-job-queue.js';
import type { QueuedJob } from '../src/queue/job-queue.js';
import { RedisFaultProxy } from './support/redis-fault-proxy.js';
import { testRedisUrl, testWorkerEnv } from './support/test-redis.js';

/**
 * VYN-05A-01: the BullMQ transport keeps the pg-boss start contract (NF-02, the five
 * pg-boss-start-retry scenarios), deduplicates by job key while a job exists, retries like
 * pg-boss (owner decision Q-05A-2), fails fast while Redis is gone and shuts down without
 * leaving a connection. Runs against the disposable Redis in TEST_REDIS_URL, directly or
 * through a fault-injecting TCP proxy; every test removes the queues it used.
 */

const WEBHOOKS = QUEUE_NAMES.WEBHOOKS_PROCESS;
const OUTBOUND = QUEUE_NAMES.MESSAGES_OUTBOUND;
const FAST: Partial<BullMqTimings> = {
  probeIntervalMs: 100,
  startTimeoutMs: 1_000,
  shutdownTimeoutMs: 3_000,
};

const redisUrl = testRedisUrl();
let admin: Redis;
const services: BullMqJobQueue[] = [];
const proxies: RedisFaultProxy[] = [];

function newService(url = redisUrl, timings: Partial<BullMqTimings> = FAST): BullMqJobQueue {
  const service = new BullMqJobQueue(testWorkerEnv({ REDIS_URL: url }), timings);
  services.push(service);
  return service;
}

async function newProxy(): Promise<RedisFaultProxy> {
  const proxy = new RedisFaultProxy(new URL(redisUrl));
  await proxy.start();
  proxies.push(proxy);
  return proxy;
}

async function shutdown(service: BullMqJobQueue): Promise<void> {
  service.onModuleDestroy();
  await service.beforeApplicationShutdown();
}

/** A handle on a queue's stored jobs, through its own connection. */
function inspect(queue: QueueName): Queue {
  return new Queue(queue, { connection: admin.duplicate(), prefix: BULLMQ_PREFIX });
}

async function removeQueues(): Promise<void> {
  for (const name of [WEBHOOKS, OUTBOUND]) {
    const queue = inspect(name);
    await queue.obliterate({ force: true });
    await queue.close();
  }
}

/** Connections to the test Redis other than `admin`'s. */
async function clientCount(): Promise<number> {
  const list = (await admin.client('LIST')) as string;
  return list.split('\n').filter((line) => line.trim().length > 0).length - 1;
}

beforeAll(async () => {
  admin = new Redis(redisUrl, { connectionName: 'vynor-test-admin' });
  await removeQueues();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(services.splice(0).map(shutdown));
  await Promise.all(proxies.splice(0).map((proxy) => proxy.stop()));
  await removeQueues();
});

afterAll(async () => {
  await admin.quit();
});

describe('BullMqJobQueue start retry (padanan pg-boss-start-retry)', () => {
  it('waits 5 s before the first retry, doubling up to 60 s', () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => BullMqJobQueue.startRetryDelayMs(n))).toEqual([
      5_000, 10_000, 20_000, 40_000, 60_000, 60_000,
    ]);
  });

  it('boots with Redis down, retries in the background, then runs a handler registered meanwhile', async () => {
    const proxy = await newProxy();
    proxy.refuse();
    vi.spyOn(BullMqJobQueue, 'startRetryDelayMs').mockReturnValue(50);
    const service = newService(proxy.url());
    const logError = vi.spyOn(
      (service as unknown as { logger: { error: (...args: unknown[]) => void } }).logger,
      'error',
    );

    await service.onModuleInit();
    expect(service.isRunning()).toBe(false);
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: 'queue_init', attempt: 1 }),
      'Failed to start the BullMQ job queue; retrying',
    );

    const handled: unknown[] = [];
    await expect(
      service.work(WEBHOOKS, async (job) => {
        handled.push(job.data);
      }),
    ).resolves.toBe(false);

    proxy.restore();
    await vi.waitFor(() => expect(service.isRunning()).toBe(true), { timeout: 10_000 });
    await service.send(WEBHOOKS, { providerEventId: 'retry-test' }, { key: 'outbox-retry-test' });
    await vi.waitFor(() => expect(handled).toEqual([{ providerEventId: 'retry-test' }]), {
      timeout: 10_000,
    });
  }, 30_000);

  it('gives up on a start that hangs, closes that connection and retries', async () => {
    const proxy = await newProxy();
    proxy.hang();
    vi.spyOn(BullMqJobQueue, 'startRetryDelayMs').mockReturnValue(200);
    const service = newService(proxy.url(), { ...FAST, startTimeoutMs: 500 });

    const startedAt = Date.now();
    await service.onModuleInit();
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(450);
    expect(service.isRunning()).toBe(false);
    // The hung attempt's connection is closed, not left behind.
    await vi.waitFor(() => expect(proxy.connections()).toBe(0), { timeout: 2_000 });

    proxy.restore();
    await vi.waitFor(() => expect(service.isRunning()).toBe(true), { timeout: 10_000 });
  }, 30_000);

  it('registers a deferred handler exactly once, and a reconnect adds no second consumer', async () => {
    const proxy = await newProxy();
    proxy.refuse();
    vi.spyOn(BullMqJobQueue, 'startRetryDelayMs').mockReturnValue(50);
    const service = newService(proxy.url());
    const runs: string[] = [];

    await service.onModuleInit();
    await service.work(WEBHOOKS, async (job) => {
      runs.push(job.id);
    });
    proxy.restore();
    await vi.waitFor(() => expect(service.isRunning()).toBe(true), { timeout: 10_000 });
    await service.send(WEBHOOKS, {}, { key: 'outbox-before-outage' });
    await vi.waitFor(() => expect(runs).toEqual(['outbox-before-outage']), { timeout: 10_000 });

    // Redis goes away and comes back: BullMQ reconnects the same consumer.
    proxy.refuse();
    await vi.waitFor(() => expect(service.isRunning()).toBe(false), { timeout: 5_000 });
    proxy.restore();
    await vi.waitFor(() => expect(service.isRunning()).toBe(true), { timeout: 15_000 });
    const keys = ['a', 'b', 'c', 'd', 'e'].map((suffix) => `outbox-after-outage-${suffix}`);
    for (const key of keys) await service.send(WEBHOOKS, {}, { key });

    await vi.waitFor(() => expect(runs).toHaveLength(6), { timeout: 20_000 });
    await sleep(500);
    expect(runs.sort()).toEqual(['outbox-before-outage', ...keys].sort());
    expect((service as unknown as { workers: Map<string, unknown> }).workers.size).toBe(1);
    await expect(service.work(WEBHOOKS, async () => undefined)).rejects.toThrow(
      'already registered',
    );
  }, 60_000);

  it('stops retrying once the module is destroyed', async () => {
    const proxy = await newProxy();
    proxy.refuse();
    vi.spyOn(BullMqJobQueue, 'startRetryDelayMs').mockReturnValue(50);
    const connect = vi.spyOn(Redis.prototype, 'connect');
    const service = newService(proxy.url());

    await service.onModuleInit();
    await vi.waitFor(() => expect(connect.mock.calls.length).toBeGreaterThanOrEqual(2));
    service.onModuleDestroy();
    await sleep(100);
    const attempts = connect.mock.calls.length;
    await sleep(500);

    expect(connect.mock.calls.length).toBe(attempts);
    expect(service.isRunning()).toBe(false);
  });

  it('closes the connection of a start that finishes after the module was destroyed', async () => {
    const proxy = await newProxy();
    proxy.hang();
    const service = newService(proxy.url(), { ...FAST, startTimeoutMs: 10_000 });

    const boot = service.onModuleInit();
    await vi.waitFor(() => expect(proxy.connections()).toBe(1));
    service.onModuleDestroy();
    proxy.restore();
    await boot;

    await vi.waitFor(() => expect(proxy.connections()).toBe(0), { timeout: 5_000 });
    expect(service.isRunning()).toBe(false);
    await expect(service.send(WEBHOOKS, {}, { key: 'outbox-late' })).rejects.toThrow(
      'BullMQ is not running',
    );
  }, 30_000);
});

describe('BullMqJobQueue jobs', () => {
  it('keeps one job per key while it exists, also after it completed', async () => {
    const service = newService();
    await service.onModuleInit();
    const runs: string[] = [];

    await service.send(WEBHOOKS, { n: 1 }, { key: 'outbox-dedup' });
    await service.send(WEBHOOKS, { n: 2 }, { key: 'outbox-dedup' });
    const queue = inspect(WEBHOOKS);
    expect(await queue.getJobCounts('waiting', 'delayed')).toEqual({ waiting: 1, delayed: 0 });

    await service.work(WEBHOOKS, async (job) => {
      runs.push(`${job.id}:${JSON.stringify(job.data)}`);
    });
    await vi.waitFor(() => expect(runs).toEqual(['outbox-dedup:{"n":1}']), { timeout: 10_000 });

    await service.send(WEBHOOKS, { n: 3 }, { key: 'outbox-dedup' });
    await sleep(500);
    expect(runs).toEqual(['outbox-dedup:{"n":1}']);
    await queue.close();
  });

  it('refuses a key with a colon without marking Redis unresponsive', async () => {
    const service = newService();
    await service.onModuleInit();

    await expect(service.send(WEBHOOKS, {}, { key: 'outbox:1' })).rejects.toThrow("contains ':'");
    expect(service.isRunning()).toBe(true);
  });

  it('stores the pg-boss retry policy and retention with each job', async () => {
    const service = newService();
    await service.onModuleInit();
    await service.send(OUTBOUND, {}, { key: 'outbox-options-outbound' });
    await service.send(WEBHOOKS, {}, { key: 'outbox-options-webhooks' });

    const outbound = await inspect(OUTBOUND).getJob('outbox-options-outbound');
    const webhooks = await inspect(WEBHOOKS).getJob('outbox-options-webhooks');
    const retention = { age: 7 * 24 * 60 * 60, count: 10_000 };
    expect(outbound?.opts).toMatchObject({
      attempts: 6,
      backoff: { type: 'fixed', delay: 5_000 },
    });
    expect(webhooks?.opts).toMatchObject({
      attempts: 6,
      backoff: { type: 'fixed', delay: 2_000 },
    });
    // BullMQ stores removeOnComplete/removeOnFail as the keep-job options it applies.
    expect(jobOptionsFor(OUTBOUND)).toMatchObject({
      removeOnComplete: retention,
      removeOnFail: retention,
    });
  });

  it('runs a failing job 6 times, 2 s apart, and tells the handler which attempt is the last', async () => {
    const service = newService();
    await service.onModuleInit();
    const attempts: { retryCount: number; retryLimit: number; at: number }[] = [];
    await service.work(WEBHOOKS, async (job: QueuedJob<Record<string, unknown>>) => {
      attempts.push({ retryCount: job.retryCount, retryLimit: job.retryLimit, at: Date.now() });
      throw new Error('provider timeout');
    });

    await service.send(WEBHOOKS, {}, { key: 'outbox-always-fails' });
    const queue = inspect(WEBHOOKS);
    await vi.waitFor(
      async () =>
        expect(await (await queue.getJob('outbox-always-fails'))?.getState()).toBe('failed'),
      { timeout: 25_000, interval: 250 },
    );

    expect(attempts.map(({ retryCount }) => retryCount)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(new Set(attempts.map(({ retryLimit }) => retryLimit))).toEqual(new Set([5]));
    for (let i = 1; i < attempts.length; i++) {
      expect(attempts[i]!.at - attempts[i - 1]!.at).toBeGreaterThanOrEqual(1_900);
    }
    await queue.close();
  }, 40_000);

  it('completes a job after one attempt when the handler returns (permanent failures included)', async () => {
    const service = newService();
    await service.onModuleInit();
    let runs = 0;
    // Handlers record permanent failures in the domain and return, so the job is not retried.
    await service.work(WEBHOOKS, async () => {
      runs += 1;
    });

    await service.send(WEBHOOKS, {}, { key: 'outbox-permanent' });
    const queue = inspect(WEBHOOKS);
    await vi.waitFor(
      async () =>
        expect(await (await queue.getJob('outbox-permanent'))?.getState()).toBe('completed'),
      { timeout: 10_000 },
    );
    await sleep(300);
    expect(runs).toBe(1);
    await queue.close();
  });
});

describe('BullMqJobQueue while Redis is unavailable', () => {
  it('rejects a send at once, holds nothing for later, and runs again once Redis is back', async () => {
    const proxy = await newProxy();
    const service = newService(proxy.url());
    await service.onModuleInit();
    expect(service.isRunning()).toBe(true);

    proxy.refuse();
    await vi.waitFor(() => expect(service.isRunning()).toBe(false), { timeout: 5_000 });
    await expect(service.send(OUTBOUND, {}, { key: 'outbox-while-down' })).rejects.toThrow(
      'BullMQ is not running',
    );
    // Below the isRunning() gate, too: the producer has no offline queue to hold the add.
    const producerQueue = (service as unknown as { queueFor(q: QueueName): Queue }).queueFor(
      OUTBOUND,
    );
    const startedAt = Date.now();
    await expect(
      producerQueue.add(OUTBOUND, {}, { jobId: 'outbox-offline-queue' }),
    ).rejects.toThrow();
    expect(Date.now() - startedAt).toBeLessThan(1_000);

    proxy.restore();
    await vi.waitFor(() => expect(service.isRunning()).toBe(true), { timeout: 10_000 });
    await sleep(500);
    const queue = inspect(OUTBOUND);
    expect(await queue.getJob('outbox-offline-queue')).toBeUndefined();
    expect(await queue.getJob('outbox-while-down')).toBeUndefined();
    await service.send(OUTBOUND, {}, { key: 'outbox-after-recovery' });
    expect(await queue.getJob('outbox-after-recovery')).toBeDefined();
    await queue.close();
  }, 30_000);

  it('reports not running while Redis hangs, and running again without a restart', async () => {
    const proxy = await newProxy();
    const service = newService(proxy.url());
    await service.onModuleInit();

    proxy.hang();
    // The probe's PING times out (command timeout 2 s), so sends stop.
    await vi.waitFor(() => expect(service.isRunning()).toBe(false), { timeout: 5_000 });
    proxy.restore();
    await vi.waitFor(() => expect(service.isRunning()).toBe(true), { timeout: 5_000 });
  }, 20_000);
});

describe('BullMqJobQueue shutdown', () => {
  it('waits for an active job and leaves no Redis connection open', async () => {
    const before = await clientCount();
    const service = newService();
    await service.onModuleInit();
    let finished = false;
    let started = false;
    await service.work(WEBHOOKS, async () => {
      started = true;
      await sleep(1_000);
      finished = true;
    });
    await service.send(WEBHOOKS, {}, { key: 'outbox-slow' });
    await vi.waitFor(() => expect(started).toBe(true), { timeout: 10_000 });

    services.splice(services.indexOf(service), 1);
    await shutdown(service);

    expect(finished).toBe(true);
    await vi.waitFor(async () => expect(await clientCount()).toBe(before), { timeout: 5_000 });
    const job = await inspect(WEBHOOKS).getJob('outbox-slow');
    expect(await job?.getState()).toBe('completed');
  }, 30_000);

  it('closes a worker whose job outlasts the shutdown timeout, leaving no connection', async () => {
    const before = await clientCount();
    const service = newService(redisUrl, { ...FAST, shutdownTimeoutMs: 300 });
    await service.onModuleInit();
    let started = false;
    await service.work(WEBHOOKS, async () => {
      started = true;
      await sleep(5_000);
    });
    await service.send(WEBHOOKS, {}, { key: 'outbox-too-slow' });
    await vi.waitFor(() => expect(started).toBe(true), { timeout: 10_000 });

    services.splice(services.indexOf(service), 1);
    const startedAt = Date.now();
    await shutdown(service);

    expect(Date.now() - startedAt).toBeLessThan(3_000);
    await vi.waitFor(async () => expect(await clientCount()).toBe(before), { timeout: 5_000 });
  }, 30_000);
});
