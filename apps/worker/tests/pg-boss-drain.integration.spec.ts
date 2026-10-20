import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { QUEUE_NAMES } from '@vynor/contracts';
import { createTestPrismaClient, type PrismaClient } from '@vynor/database';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { PgBoss } from 'pg-boss';
import { isHeartbeatFresh } from '../src/health/heartbeat.js';
import { WorkerHeartbeatService } from '../src/health/worker-heartbeat.service.js';
import { OutboxDispatcherService } from '../src/outbox/outbox-dispatcher.service.js';
import { BULLMQ_PREFIX, BullMqJobQueue } from '../src/queue/bullmq-job-queue.js';
import { DrainingJobQueue } from '../src/queue/draining-job-queue.js';
import { PgBossDrainMonitor } from '../src/queue/pg-boss-drain-monitor.service.js';
import { PgBossService } from '../src/queue/pg-boss.service.js';
import { RedisFaultProxy } from './support/redis-fault-proxy.js';
import { testRedisUrl, testWorkerEnv } from './support/test-redis.js';

/**
 * VYN-05A-02: during the expand phase new jobs go to BullMQ only, pg-boss keeps draining the
 * jobs it held before the cutover, and readiness follows BullMQ alone (owner decision Q-05A-1,
 * DEGRADED). Runs the real pg-boss against the test database in its own schema (dropped
 * afterwards) and BullMQ against the disposable Redis in TEST_REDIS_URL.
 */

const SCHEMA = 'pgboss_drain_test';
const WEBHOOKS = QUEUE_NAMES.WEBHOOKS_PROCESS;
const OUTBOUND = QUEUE_NAMES.MESSAGES_OUTBOUND;
const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
const redisUrl = testRedisUrl();
const env = testWorkerEnv({
  DATABASE_URL: databaseUrl,
  DIRECT_URL: databaseUrl,
  PG_BOSS_SCHEMA: SCHEMA,
  REDIS_URL: redisUrl,
});

let db: PrismaClient;
let admin: Redis;
let workspaceId: string;
let dir: string;
const stops: (() => Promise<void>)[] = [];

function pgBoss(): PgBossService {
  const service = new PgBossService(env);
  stops.push(() => service.onModuleDestroy());
  return service;
}

async function bullmq(url = redisUrl): Promise<BullMqJobQueue> {
  const service = new BullMqJobQueue({ ...env, REDIS_URL: url }, { probeIntervalMs: 100 });
  stops.push(async () => {
    service.onModuleDestroy();
    await service.beforeApplicationShutdown();
  });
  await service.onModuleInit();
  return service;
}

async function pgBossJobs(states = ['created', 'retry', 'active', 'completed']): Promise<number> {
  const [row] = await db.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT count(*) AS count FROM "${SCHEMA}".job WHERE state::text = ANY($1::text[])`,
    states,
  );
  return Number(row?.count ?? 0);
}

async function removeQueues(): Promise<void> {
  for (const name of [WEBHOOKS, OUTBOUND]) {
    const queue = new Queue(name, { connection: admin.duplicate(), prefix: BULLMQ_PREFIX });
    await queue.obliterate({ force: true });
    await queue.close();
  }
}

function warnSpy(target: object) {
  return vi.spyOn((target as { logger: { warn: (...args: unknown[]) => void } }).logger, 'warn');
}

beforeAll(async () => {
  db = createTestPrismaClient();
  admin = new Redis(redisUrl);
  const workspace = await db.workspace.create({
    data: { name: 'pg-boss drain', slug: `pgboss-drain-${randomBytes(4).toString('hex')}` },
  });
  workspaceId = workspace.id;
  dir = await mkdtemp(join(tmpdir(), 'vynor-drain-'));
});

afterEach(async () => {
  vi.restoreAllMocks();
  for (const stop of stops.splice(0).reverse()) await stop();
  await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
  await db.outboxEvent.deleteMany({ where: { workspaceId } });
  await removeQueues();
});

afterAll(async () => {
  await db.workspace.delete({ where: { id: workspaceId } });
  await db.$disconnect();
  await admin.quit();
  await rm(dir, { recursive: true, force: true });
});

describe('dual transport while pg-boss drains', () => {
  it('dispatches new outbox events to BullMQ only; pg-boss receives no job', async () => {
    const drain = pgBoss();
    await drain.onModuleInit();
    const primary = await bullmq();
    const dispatcher = new OutboxDispatcherService(new DrainingJobQueue(primary, drain));
    const event = await db.outboxEvent.create({
      data: {
        workspaceId,
        eventType: 'webhook.received',
        payload: { providerEventId: 'drain-test' },
        correlationId: 'corr-drain',
      },
    });

    await expect(dispatcher.pollAndDispatch()).resolves.toBe(1);

    expect((await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } })).status).toBe(
      'COMPLETED',
    );
    const inspect = new Queue(WEBHOOKS, { connection: admin.duplicate(), prefix: BULLMQ_PREFIX });
    const job = await inspect.getJob(`outbox-${event.id}`);
    await inspect.close();
    expect(job?.data).toMatchObject({
      jobId: event.id,
      payload: { providerEventId: 'drain-test' },
    });
    expect(await pgBossJobs()).toBe(0);
  }, 30_000);

  it('runs every job pg-boss held before the cutover once, next to new BullMQ jobs', async () => {
    const drain = pgBoss();
    await drain.onModuleInit();
    for (const n of [1, 2, 3]) {
      await drain.sendJob(WEBHOOKS, { n: `old-${n}` }, { singletonKey: `outbox:old-${n}` });
    }
    const queue = new DrainingJobQueue(await bullmq(), drain);
    const runs: string[] = [];

    await queue.work(WEBHOOKS, async (job) => {
      runs.push(String(job.data.n));
    });
    await queue.send(WEBHOOKS, { n: 'new-1' }, { key: 'outbox-new-1' });

    await vi.waitFor(() => expect(runs).toHaveLength(4), { timeout: 15_000 });
    await sleep(1_500);
    expect(runs.sort()).toEqual(['new-1', 'old-1', 'old-2', 'old-3']);
    expect(await pgBossJobs(['created', 'retry', 'active'])).toBe(0);
  }, 30_000);

  it('NF-15: a standard pg-boss queue accepts a second job under the same singleton key', async () => {
    const drain = pgBoss();
    await drain.onModuleInit();

    const first = await drain.sendJob(OUTBOUND, {}, { singletonKey: 'outbox:same-event' });
    const second = await drain.sendJob(OUTBOUND, {}, { singletonKey: 'outbox:same-event' });

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
    expect(await pgBossJobs(['created'])).toBe(2);
  });
});

describe('readiness and the pg-boss drain (owner decision Q-05A-1, DEGRADED)', () => {
  it('keeps the heartbeat while the drain cannot start, logs DEGRADED, and recovers', async () => {
    // pg-boss held a job before the cutover...
    const before = pgBoss();
    await before.onModuleInit();
    await before.sendJob(WEBHOOKS, { n: 'old' }, { singletonKey: 'outbox:old' });
    await before.onModuleDestroy();

    // ...and the new worker's pg-boss fails its first start.
    vi.spyOn(PgBoss.prototype, 'start').mockRejectedValueOnce(new Error('connection refused'));
    vi.spyOn(PgBossService, 'startRetryDelayMs').mockReturnValue(1_500);
    const drain = pgBoss();
    await drain.onModuleInit();
    expect(drain.isRunning()).toBe(false);
    const primary = await bullmq();
    const queue = new DrainingJobQueue(primary, drain);
    const runs: string[] = [];
    await queue.work(WEBHOOKS, async (job) => {
      runs.push(String(job.data.n));
    });
    const heartbeat = new WorkerHeartbeatService(queue);
    const monitor = new PgBossDrainMonitor(env, drain, primary);
    const warn = warnSpy(monitor);

    expect(queue.isRunning()).toBe(true);
    await expect(heartbeat.beat(join(dir, 'degraded.heartbeat'))).resolves.toBe(true);
    await expect(isHeartbeatFresh(join(dir, 'degraded.heartbeat'))).resolves.toBe(true);
    const degraded = await monitor.check();
    expect(degraded).toMatchObject({
      drainRunning: false,
      pgBossBacklogTotal: 1,
      drainVerifiedComplete: false,
    });
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: 'pgboss_drain', drainRunning: false }),
      expect.stringContaining('pg-boss drain DEGRADED'),
    );

    // The start retry succeeds, the deferred drain consumer registers and runs the old job.
    await vi.waitFor(() => expect(runs).toEqual(['old']), { timeout: 15_000 });
    await vi.waitFor(async () => expect((await monitor.check()).drainVerifiedComplete).toBe(true), {
      timeout: 10_000,
    });
  }, 40_000);

  it('writes no heartbeat while BullMQ cannot take jobs, though the database and pg-boss answer', async () => {
    const drain = pgBoss();
    await drain.onModuleInit();
    const proxy = new RedisFaultProxy(new URL(redisUrl));
    await proxy.start();
    stops.push(() => proxy.stop());
    proxy.refuse();
    vi.spyOn(BullMqJobQueue, 'startRetryDelayMs').mockReturnValue(60_000);
    const queue = new DrainingJobQueue(await bullmq(proxy.url()), drain);
    const file = join(dir, 'no-bullmq.heartbeat');

    expect(drain.isRunning()).toBe(true);
    expect(queue.isRunning()).toBe(false);
    await expect(new WorkerHeartbeatService(queue).beat(file)).resolves.toBe(false);
    await expect(isHeartbeatFresh(file)).resolves.toBe(false);
  }, 30_000);
});

describe('PgBossDrainMonitor', () => {
  it('counts the backlog on both transports and only reports completion once pg-boss is verified empty', async () => {
    const drain = pgBoss();
    await drain.onModuleInit();
    await drain.sendJob(WEBHOOKS, { n: 1 }, { singletonKey: 'outbox:a' });
    await drain.sendJob(OUTBOUND, { n: 2 }, { singletonKey: 'outbox:b' });
    const primary = await bullmq();
    await primary.send(WEBHOOKS, { n: 3 }, { key: 'outbox-c' });
    const monitor = new PgBossDrainMonitor(env, drain, primary);
    const info = vi.spyOn(
      (monitor as unknown as { logger: { info: (...args: unknown[]) => void } }).logger,
      'info',
    );

    const pending = await monitor.check();
    expect(pending).toMatchObject({
      drainRunning: true,
      pgBossBacklogTotal: 2,
      drainVerifiedComplete: false,
      pgBossBacklog: { [WEBHOOKS]: { created: 1 }, [OUTBOUND]: { created: 1 } },
    });
    expect(pending.bullmqBacklog?.[WEBHOOKS]).toMatchObject({ waiting: 1 });
    expect(info).toHaveBeenLastCalledWith(expect.anything(), 'pg-boss drain in progress');

    const queue = new DrainingJobQueue(primary, drain);
    for (const name of [WEBHOOKS, OUTBOUND]) await queue.work(name, async () => undefined);
    await vi.waitFor(async () => expect((await monitor.check()).drainVerifiedComplete).toBe(true), {
      timeout: 15_000,
    });
    expect(info).toHaveBeenLastCalledWith(
      expect.objectContaining({ pgBossBacklogTotal: 0 }),
      'pg-boss drain complete: no pg-boss job is left in created, retry or active state',
    );
  }, 30_000);

  it('reports the drain as unknown, never complete, when the backlog cannot be counted', async () => {
    const drain = pgBoss();
    const monitor = new PgBossDrainMonitor(
      { ...env, PG_BOSS_SCHEMA: 'pgboss_schema_that_does_not_exist' },
      drain,
      await bullmq(),
    );
    const warn = warnSpy(monitor);

    const status = await monitor.check();

    expect(status).toMatchObject({
      pgBossBacklog: null,
      pgBossBacklogTotal: null,
      drainVerifiedComplete: false,
    });
    expect(warn).toHaveBeenCalledWith(
      expect.anything(),
      'pg-boss drain status unknown: its backlog could not be counted',
    );
  });
});
