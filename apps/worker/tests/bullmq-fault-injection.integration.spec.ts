import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { QUEUE_NAMES, type QueueName } from '@vynor/contracts';
import { createTestPrismaClient, type PrismaClient } from '@vynor/database';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { ChannelHealthRecorder } from '../src/channels/channel-health.service.js';
import { ConversationIngestService } from '../src/conversations/conversation-ingest.service.js';
import { WorkerHeartbeatService } from '../src/health/worker-heartbeat.service.js';
import { OutboxDispatcherService } from '../src/outbox/outbox-dispatcher.service.js';
import { OutboxReconciliationService } from '../src/outbox/outbox-reconciliation.service.js';
import { InboundProcessorService } from '../src/processing/inbound-processor.service.js';
import { OutboundDispatcherService } from '../src/processing/outbound-dispatcher.service.js';
import {
  BULLMQ_PREFIX,
  BullMqJobQueue,
  type BullMqTimings,
} from '../src/queue/bullmq-job-queue.js';
import type { JobQueue } from '../src/queue/job-queue.js';
import { RedisFaultProxy } from './support/redis-fault-proxy.js';
import { testRedisUrl, testWorkerEnv } from './support/test-redis.js';
import {
  createWhatsAppChannel,
  fakeGraph,
  textMessage,
  type WhatsAppChannel,
} from './support/whatsapp-channel.js';

/**
 * VYN-05A-03: fault injection on the outbox → BullMQ → worker path. A dispatcher that dies
 * after the add, a worker that dies during a job, Redis down or hung, a job Redis lost after
 * the outbox committed COMPLETED, and 1,000 webhooks with retries: no domain event is lost or
 * applied twice, the reply is sent once, and while BullMQ cannot take jobs nothing is claimed,
 * no heartbeat is written and no outbox row is COMPLETED. Runs against the test database and
 * the disposable Redis in TEST_REDIS_URL (directly or through a fault-injecting proxy).
 */

const WEBHOOKS = QUEUE_NAMES.WEBHOOKS_PROCESS;
const OUTBOUND = QUEUE_NAMES.MESSAGES_OUTBOUND;
const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const STALLING_WORKER = fileURLToPath(new URL('./support/stalling-worker.ts', import.meta.url));
/** The worker's tsconfig enables the decorators Nest needs; tsx would not find it from the root. */
const WORKER_TSCONFIG = fileURLToPath(new URL('../tsconfig.json', import.meta.url));
const redisUrl = testRedisUrl();

let db: PrismaClient;
let admin: Redis;
let dir: string;
let workspaceId: string;
const cleanups: (() => Promise<unknown> | unknown)[] = [];

async function startQueue(
  url = redisUrl,
  timings: Partial<BullMqTimings> = { probeIntervalMs: 100 },
): Promise<BullMqJobQueue> {
  const queue = new BullMqJobQueue(testWorkerEnv({ REDIS_URL: url }), timings);
  cleanups.push(async () => {
    queue.onModuleDestroy();
    await queue.beforeApplicationShutdown();
  });
  await queue.onModuleInit();
  return queue;
}

async function channelFixture(): Promise<WhatsAppChannel> {
  const channel = await createWhatsAppChannel(db);
  cleanups.push(() => channel.remove());
  return channel;
}

async function newProxy(): Promise<RedisFaultProxy> {
  const proxy = new RedisFaultProxy(new URL(redisUrl));
  await proxy.start();
  cleanups.push(() => proxy.stop());
  return proxy;
}

/** Runs a consumer's real bootstrap (handler registration), which NODE_ENV=test skips. */
async function bootstrap(consumer: { onApplicationBootstrap(): Promise<void> }): Promise<void> {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  try {
    await consumer.onApplicationBootstrap();
  } finally {
    process.env.NODE_ENV = previous;
  }
}

async function consumers(queue: JobQueue, channel: WhatsAppChannel) {
  const inbound = new InboundProcessorService(
    queue,
    channel.runtime,
    new ConversationIngestService(),
  );
  const outbound = new OutboundDispatcherService(
    queue,
    channel.runtime,
    new ChannelHealthRecorder(),
  );
  await bootstrap(inbound);
  await bootstrap(outbound);
  cleanups.push(() => outbound.onApplicationShutdown());
  return { inbound, outbound };
}

function inspect(queue: QueueName): Queue {
  const handle = new Queue(queue, { connection: admin.duplicate(), prefix: BULLMQ_PREFIX });
  cleanups.push(() => handle.close());
  return handle;
}

async function removeQueues(): Promise<void> {
  for (const name of [WEBHOOKS, OUTBOUND]) {
    const queue = new Queue(name, { connection: admin.duplicate(), prefix: BULLMQ_PREFIX });
    await queue.obliterate({ force: true });
    await queue.close();
  }
}

/** Dispatches until no outbox row of `workspace` is PENDING (the dispatcher claims 50 a cycle). */
async function dispatchAll(dispatcher: OutboxDispatcherService, workspace: string) {
  for (let cycle = 0; cycle < 200; cycle++) {
    await dispatcher.pollAndDispatch();
    const pending = await db.outboxEvent.count({
      where: { workspaceId: workspace, status: { in: ['PENDING', 'PROCESSING'] } },
    });
    if (pending === 0) return;
  }
  throw new Error('outbox did not drain');
}

function genericEvent(providerEventId: string) {
  return db.outboxEvent.create({
    data: {
      workspaceId,
      eventType: 'webhook.received',
      payload: { providerEventId },
      correlationId: `corr-${providerEventId}`,
    },
  });
}

beforeAll(async () => {
  db = createTestPrismaClient();
  admin = new Redis(redisUrl);
  dir = await mkdtemp(join(tmpdir(), 'vynor-fault-'));
  const workspace = await db.workspace.create({
    data: { name: 'Fault Injection Generic', slug: `fault-generic-${Date.now()}` },
  });
  workspaceId = workspace.id;
});

beforeEach(async () => {
  // The dispatcher claims every pending row of the test database; start from none.
  await db.outboxEvent.deleteMany({ where: { status: { in: ['PENDING', 'PROCESSING'] } } });
  await removeQueues();
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  await db.outboxEvent.deleteMany({ where: { workspaceId } });
});

afterAll(async () => {
  await removeQueues();
  await db.workspace.delete({ where: { id: workspaceId } });
  await db.$disconnect();
  await admin.quit();
  await rm(dir, { recursive: true, force: true });
});

describe('crashes around the BullMQ add', () => {
  it('a dispatcher that dies after the add and before COMPLETED does not get the reply sent twice', async () => {
    const channel = await channelFixture();
    const queue = await startQueue();
    await consumers(queue, channel);
    const sent = fakeGraph();
    await channel.journal([textMessage('6281234500001', 'Rina', 'wamid.CRASH-IN', 'Halo')]);
    await dispatchAll(new OutboxDispatcherService(queue), channel.workspaceId);
    const conversation = await vi.waitFor(
      () => db.conversation.findFirstOrThrow({ where: { providerAccountId: channel.channelId } }),
      { timeout: 10_000 },
    );
    const reply = await channel.createReply(conversation.id, 'Siap, kak');

    // Dispatcher A hands the job to BullMQ, then its process stops before marking COMPLETED.
    const dying: JobQueue = {
      isRunning: () => queue.isRunning(),
      work: (...args) => queue.work(...args),
      send: async (...args) => {
        await queue.send(...args);
        await new Promise<never>(() => {});
      },
    };
    void new OutboxDispatcherService(dying).pollAndDispatch();
    await vi.waitFor(() => expect(sent).toHaveLength(1), { timeout: 10_000 });
    expect((await db.outboxEvent.findUniqueOrThrow({ where: { id: reply.eventId } })).status).toBe(
      'PROCESSING',
    );

    // Its lease runs out; another worker recovers the event and dispatches it again.
    await db.outboxEvent.update({
      where: { id: reply.eventId },
      data: { claimLeaseExpiresAt: new Date(Date.now() - 1_000) },
    });
    const survivor = new OutboxDispatcherService(queue);
    await survivor.runLeaseRecovery();
    await expect(survivor.pollAndDispatch()).resolves.toBe(1);

    await sleep(1_500);
    expect(sent).toHaveLength(1);
    await expect(
      db.outboxEvent.findUniqueOrThrow({ where: { id: reply.eventId } }),
    ).resolves.toMatchObject({ status: 'COMPLETED', retryCount: 1 });
    await expect(
      db.message.findUniqueOrThrow({ where: { id: reply.messageId } }),
    ).resolves.toMatchObject({ status: 'SENT', providerMessageId: 'wamid.OUT-1' });
    // The re-dispatch found the job BullMQ already held: one job, run once.
    const job = await inspect(OUTBOUND).getJob(`outbox-${reply.eventId}`);
    expect(await job?.getState()).toBe('completed');
    expect(job?.attemptsStarted).toBe(1);
  }, 60_000);

  it('a re-dispatch after the job was removed runs the handler again, and the reply is still sent once', async () => {
    const channel = await channelFixture();
    const queue = await startQueue();
    await consumers(queue, channel);
    const sent = fakeGraph();
    const dispatcher = new OutboxDispatcherService(queue);
    await channel.journal([textMessage('6281234500002', 'Budi', 'wamid.RETENTION-IN', 'Halo')]);
    await dispatchAll(dispatcher, channel.workspaceId);
    const conversation = await vi.waitFor(
      () => db.conversation.findFirstOrThrow({ where: { providerAccountId: channel.channelId } }),
      { timeout: 10_000 },
    );
    const reply = await channel.createReply(conversation.id, 'Pesanan dikirim');
    await dispatchAll(dispatcher, channel.workspaceId);
    const outbound = inspect(OUTBOUND);
    const finished = async () =>
      expect(await (await outbound.getJob(`outbox-${reply.eventId}`))?.getState()).toBe(
        'completed',
      );
    await vi.waitFor(finished, { timeout: 10_000 });
    expect(sent).toHaveLength(1);

    // Retention removed the job, then the event is dispatched again (e.g. a manual replay).
    await (await outbound.getJob(`outbox-${reply.eventId}`))?.remove();
    await db.outboxEvent.update({ where: { id: reply.eventId }, data: { status: 'PENDING' } });
    await expect(dispatcher.pollAndDispatch()).resolves.toBe(1);
    await vi.waitFor(finished, { timeout: 10_000 });

    // The handler ran again, but only PENDING replies are sent (domain idempotency).
    expect(sent).toHaveLength(1);
  }, 60_000);

  it('a worker that dies during an active job: another worker runs the job, once', async () => {
    const timings = { probeIntervalMs: 100, lockDurationMs: 1_000, stalledIntervalMs: 500 };
    const queue = await startQueue(redisUrl, timings);
    await queue.send(WEBHOOKS, { n: 1 }, { key: 'outbox-worker-dies' });

    const child = spawn(process.execPath, ['--import', 'tsx', STALLING_WORKER], {
      cwd: REPO_ROOT,
      env: { ...process.env, TEST_REDIS_URL: redisUrl, TSX_TSCONFIG_PATH: WORKER_TSCONFIG },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    cleanups.push(() => child.kill('SIGKILL'));
    await new Promise<void>((resolve, reject) => {
      child.on('exit', (code) => reject(new Error(`stalling worker exited early (${code})`)));
      child.stdout.on('data', (chunk: Buffer) => {
        if (chunk.toString().includes('ACTIVE outbox-worker-dies')) resolve();
      });
    });
    child.removeAllListeners('exit');
    child.kill('SIGKILL');
    await once(child, 'exit');

    const runs: number[] = [];
    await queue.work(WEBHOOKS, async (job) => {
      runs.push(job.retryCount);
    });
    await vi.waitFor(() => expect(runs).toHaveLength(1), { timeout: 15_000 });
    await sleep(2_000);

    // Run once more, and the stall did not count as a failed attempt.
    expect(runs).toEqual([0]);
    const job = await inspect(WEBHOOKS).getJob('outbox-worker-dies');
    expect(await job?.getState()).toBe('completed');
  }, 60_000);
});

describe('Redis outages', () => {
  it('Redis down: nothing claimed, no heartbeat, nothing COMPLETED; all resumes without a restart', async () => {
    const proxy = await newProxy();
    const queue = await startQueue(proxy.url());
    const runs: string[] = [];
    await queue.work(WEBHOOKS, async (job) => {
      runs.push(String(job.data.jobId));
    });
    const heartbeat = new WorkerHeartbeatService(queue);
    const file = join(dir, 'down.heartbeat');
    const dispatcher = new OutboxDispatcherService(queue);

    proxy.refuse();
    await vi.waitFor(() => expect(queue.isRunning()).toBe(false), { timeout: 5_000 });
    const event = await genericEvent('redis-down');
    await expect(dispatcher.pollAndDispatch()).resolves.toBe(0);
    await expect(
      db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } }),
    ).resolves.toMatchObject({
      status: 'PENDING',
      retryCount: 0,
      claimedBy: null,
      dispatchedAt: null,
    });
    await expect(heartbeat.beat(file)).resolves.toBe(false);

    proxy.restore();
    await vi.waitFor(() => expect(queue.isRunning()).toBe(true), { timeout: 15_000 });
    await expect(dispatcher.pollAndDispatch()).resolves.toBe(1);
    // The consumer reconnected on its own and runs the job once.
    await vi.waitFor(() => expect(runs).toEqual([event.id]), { timeout: 20_000 });
    await expect(heartbeat.beat(file)).resolves.toBe(true);
    await sleep(1_000);
    expect(runs).toEqual([event.id]);
  }, 60_000);

  it('Redis hangs during a send: one attempt used, no COMPLETED; the held add lands and is not run twice', async () => {
    const proxy = await newProxy();
    const queue = await startQueue(proxy.url(), { probeIntervalMs: 1_000 });
    const runs: string[] = [];
    await queue.work(WEBHOOKS, async (job) => {
      runs.push(String(job.data.jobId));
    });
    const heartbeat = new WorkerHeartbeatService(queue);
    const file = join(dir, 'hung.heartbeat');
    const dispatcher = new OutboxDispatcherService(queue);
    const event = await genericEvent('redis-hangs');

    // Redis stops answering just as the dispatcher sends: the add times out after 2 s.
    proxy.hang();
    await expect(dispatcher.pollAndDispatch()).resolves.toBe(0);
    const failed = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(failed).toMatchObject({ status: 'PENDING', retryCount: 1, dispatchedAt: null });
    expect(failed.lastError).toMatch(/timed out/i);
    expect(queue.isRunning()).toBe(false);
    await expect(heartbeat.beat(file)).resolves.toBe(false);
    await expect(dispatcher.pollAndDispatch()).resolves.toBe(0);

    // Redis answers again, so the add it held arrives and creates the job after all.
    proxy.restore();
    await vi.waitFor(() => expect(queue.isRunning()).toBe(true), { timeout: 10_000 });
    await expect(dispatcher.pollAndDispatch()).resolves.toBe(1);
    await vi.waitFor(() => expect(runs).toEqual([event.id]), { timeout: 20_000 });
    await sleep(1_500);
    expect(runs).toEqual([event.id]);
    await expect(heartbeat.beat(file)).resolves.toBe(true);
    await expect(
      db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } }),
    ).resolves.toMatchObject({ status: 'COMPLETED' });
  }, 60_000);
});

describe('outbox reconciliation (07 §4.1, §8.2)', () => {
  it('finds COMPLETED events whose job Redis lost, and the runbook replay processes them once', async () => {
    const channel = await channelFixture();
    const queue = await startQueue();
    const reconciliation = new OutboxReconciliationService(queue);
    const dispatcher = new OutboxDispatcherService(queue);
    const sent = fakeGraph();
    const [lostId, keptId, doneId] = await channel.journal([
      textMessage('6281234500011', 'Lost', 'wamid.LOST', 'job lost'),
      textMessage('6281234500012', 'Kept', 'wamid.KEPT', 'job kept'),
      textMessage('6281234500013', 'Done', 'wamid.DONE', 'already processed'),
    ]);
    await dispatchAll(dispatcher, channel.workspaceId);
    const rows = await db.outboxEvent.findMany({ where: { workspaceId: channel.workspaceId } });
    const outboxFor = (providerEventId: string | undefined) =>
      rows.find(
        (row) => (row.payload as { providerEventId?: string }).providerEventId === providerEventId,
      )!;
    // Handed over 11 minutes ago, no consumer yet; Redis then lost one job (AOF window), and
    // one event was processed and its job pruned by retention.
    await db.outboxEvent.updateMany({
      where: { workspaceId: channel.workspaceId },
      data: { dispatchedAt: new Date(Date.now() - 11 * 60_000) },
    });
    const webhooks = inspect(WEBHOOKS);
    await (await webhooks.getJob(`outbox-${outboxFor(lostId).id}`))?.remove();
    await (await webhooks.getJob(`outbox-${outboxFor(doneId).id}`))?.remove();
    await db.providerEvent.update({ where: { id: doneId! }, data: { status: 'PROCESSED' } });
    const alert = vi.spyOn(
      (reconciliation as unknown as { logger: { error: (...args: unknown[]) => void } }).logger,
      'error',
    );

    const lost = await reconciliation.check();

    expect(lost).toEqual([
      expect.objectContaining({
        eventId: outboxFor(lostId).id,
        eventType: 'webhook.received',
        replay: 'safe',
      }),
    ]);
    expect(alert).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: 'outbox_reconciliation', count: 1 }),
      expect.stringContaining('reconciliation runbook'),
    );

    // Runbook: the 07 §4.1 UPDATE, limited to the reported IDs (sandbox database only).
    const ids = lost!.map((job) => job.eventId);
    await db.$executeRaw`
      UPDATE outbox_events
      SET status = 'PENDING', processed_at = NULL, dispatched_at = NULL,
          claimed_by = NULL, claim_lease_expires_at = NULL, updated_at = NOW()
      WHERE id = ANY(${ids}::text[]) AND status = 'COMPLETED'`;
    await expect(dispatcher.pollAndDispatch()).resolves.toBe(1);
    await consumers(queue, channel);

    await vi.waitFor(
      async () =>
        expect(
          await db.providerEvent.count({
            where: { id: { in: [lostId!, keptId!] }, status: 'PROCESSED' },
          }),
        ).toBe(2),
      { timeout: 15_000 },
    );
    await sleep(1_000);
    for (const wamid of ['wamid.LOST', 'wamid.KEPT']) {
      await expect(
        db.message.count({
          where: { providerAccountId: channel.channelId, providerMessageId: wamid },
        }),
      ).resolves.toBe(1);
    }
    await expect(reconciliation.findLostJobs()).resolves.toEqual([]);
    expect(sent).toHaveLength(0);
  }, 60_000);

  it('marks a lost outbound reply for operator review instead of a blind replay', async () => {
    const channel = await channelFixture();
    const queue = await startQueue();
    const dispatcher = new OutboxDispatcherService(queue);
    await channel.journal([textMessage('6281234500021', 'Review', 'wamid.REVIEW-IN', 'Halo')]);
    await dispatchAll(dispatcher, channel.workspaceId);
    await consumers(queue, channel);
    const conversation = await vi.waitFor(
      () => db.conversation.findFirstOrThrow({ where: { providerAccountId: channel.channelId } }),
      { timeout: 10_000 },
    );
    // Stop consuming, then dispatch a reply whose job Redis loses.
    const reply = await channel.createReply(conversation.id, 'Ditunggu ya');
    const outboundQueue = inspect(OUTBOUND);
    await outboundQueue.pause();
    await dispatchAll(dispatcher, channel.workspaceId);
    await (await outboundQueue.getJob(`outbox-${reply.eventId}`))?.remove();
    await db.outboxEvent.update({
      where: { id: reply.eventId },
      data: { dispatchedAt: new Date(Date.now() - 11 * 60_000) },
    });

    await expect(new OutboxReconciliationService(queue).findLostJobs()).resolves.toEqual([
      expect.objectContaining({ eventId: reply.eventId, replay: 'review' }),
    ]);
    await outboundQueue.resume();
  }, 60_000);
});

describe('load', () => {
  it('turns 1,000 webhooks (with replays and transient failures) into 1,000 messages, ordered per conversation', async () => {
    const channel = await channelFixture();
    const queue = await startQueue();
    const { inbound } = await consumers(queue, channel);
    // Every 20th event fails its first attempt, so it is retried (2 s later).
    const process = inbound.process.bind(inbound);
    const failedOnce = new Set<string>();
    let calls = 0;
    vi.spyOn(inbound, 'process').mockImplementation(async (id, correlationId) => {
      calls += 1;
      if (!failedOnce.has(id) && parseInt(id.slice(-2), 16) % 20 === 0) {
        failedOnce.add(id);
        throw new Error('injected transient failure');
      }
      return process(id, correlationId);
    });

    const senders = 50;
    const perSender = 20;
    const base = Math.floor(Date.now() / 1000) - 3_600;
    const payloads = [];
    for (let i = 0; i < perSender; i++) {
      for (let s = 0; s < senders; s++) {
        const from = `62812${String(s).padStart(7, '0')}`;
        payloads.push(
          textMessage(
            from,
            `Sender ${s}`,
            `wamid.LOAD-${s}-${i}`,
            `msg ${s}-${i}`,
            base + i * 60 + s,
          ),
        );
      }
    }
    // Providers redeliver: 50 replays of earlier messages arrive in later batches.
    const replays = payloads.filter((_, n) => n % 20 === 7);
    const accepted: string[] = [];
    for (let n = 0; n < payloads.length; n += 100) {
      accepted.push(...(await channel.journal(payloads.slice(n, n + 100))));
      if (n === 500) accepted.push(...(await channel.journal(replays)));
    }
    expect(accepted).toHaveLength(senders * perSender);

    const dispatcher = new OutboxDispatcherService(queue);
    const startedAt = Date.now();
    await dispatchAll(dispatcher, channel.workspaceId);
    await vi.waitFor(
      async () =>
        expect(
          await db.providerEvent.count({
            where: { workspaceId: channel.workspaceId, status: 'PROCESSED' },
          }),
        ).toBe(1_000),
      { timeout: 180_000, interval: 1_000 },
    );
    const elapsedMs = Date.now() - startedAt;

    const messages = await db.message.findMany({
      where: { workspaceId: channel.workspaceId },
      select: { providerMessageId: true, conversationId: true, text: true, createdAt: true },
    });
    expect(messages).toHaveLength(1_000);
    expect(new Set(messages.map((m) => m.providerMessageId)).size).toBe(1_000);
    const conversations = await db.conversation.findMany({
      where: { workspaceId: channel.workspaceId },
      include: { messages: { orderBy: { createdAt: 'asc' }, select: { text: true } } },
    });
    expect(conversations).toHaveLength(senders);
    for (const conversation of conversations) {
      const texts = conversation.messages.map((m) => m.text!);
      const sender = texts[0]!.split(' ')[1]!.split('-')[0];
      // Timeline order follows the provider timestamps, whatever order the jobs ran in.
      expect(texts).toEqual(Array.from({ length: perSender }, (_, i) => `msg ${sender}-${i}`));
      expect(conversation.lastMessagePreview).toBe(`msg ${sender}-${perSender - 1}`);
      expect(conversation.unreadCount).toBe(perSender);
    }
    await expect(
      db.outboxEvent.groupBy({
        by: ['status'],
        where: { workspaceId: channel.workspaceId },
        _count: true,
      }),
    ).resolves.toEqual([{ status: 'COMPLETED', _count: 1_000 }]);
    expect(failedOnce.size).toBeGreaterThan(0);
    expect(calls).toBe(1_000 + failedOnce.size);
    const counts = await inspect(WEBHOOKS).getJobCounts(
      'completed',
      'failed',
      'waiting',
      'active',
      'delayed',
    );
    expect(counts).toEqual({ completed: 1_000, failed: 0, waiting: 0, active: 0, delayed: 0 });
    console.info(
      `[load] 1000 webhooks → 1000 messages in ${elapsedMs} ms; ${failedOnce.size} jobs retried once`,
    );
  }, 240_000);
});
