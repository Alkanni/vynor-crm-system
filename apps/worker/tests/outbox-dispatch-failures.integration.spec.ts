import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestPrismaClient, type PrismaClient } from '@vynor/database';
import { OutboxDispatcherService } from '../src/outbox/outbox-dispatcher.service.js';
import { BullMqJobQueue } from '../src/queue/bullmq-job-queue.js';
import type { JobQueue } from '../src/queue/job-queue.js';
import { PgBossService } from '../src/queue/pg-boss.service.js';
import { testWorkerEnv } from './support/test-redis.js';

/**
 * Outbox events must never be marked COMPLETED unless the job queue accepted (or already holds)
 * the job: an unavailable queue leaves them PENDING, a failed send retries and finally
 * dead-letters. Runs against the test database. The dispatcher claims every pending row, so
 * each test starts from an empty outbox. bullmq-job-queue specs cover the real BullMQ sends.
 */

const env = testWorkerEnv();

/** A queue that is running and answers every send with `send`. */
function runningQueue(send: JobQueue['send']): JobQueue & { send: ReturnType<typeof vi.fn> } {
  return { isRunning: () => true, send: vi.fn(send) } as unknown as JobQueue & {
    send: ReturnType<typeof vi.fn>;
  };
}

describe('outbox dispatch when the job queue cannot take the job', () => {
  const suffix = randomBytes(4).toString('hex');
  let db: PrismaClient;
  let workspaceId: string;

  function createEvent(retryCount = 0) {
    return db.outboxEvent.create({
      data: {
        workspaceId,
        eventType: 'message.outbound.requested',
        payload: { messageId: `msg-${suffix}` },
        correlationId: `corr-${suffix}`,
        status: 'PENDING',
        retryCount,
      },
    });
  }

  function reload(id: string) {
    return db.outboxEvent.findUniqueOrThrow({ where: { id } });
  }

  beforeAll(async () => {
    db = createTestPrismaClient();
    const workspace = await db.workspace.create({
      data: { name: 'Outbox Dispatch Failures', slug: `outbox-dispatch-${suffix}` },
    });
    workspaceId = workspace.id;
  });

  beforeEach(async () => {
    await db.outboxEvent.deleteMany();
  });

  afterAll(async () => {
    await db.outboxEvent.deleteMany({ where: { workspaceId } });
    await db.workspace.delete({ where: { id: workspaceId } });
    await db.$disconnect();
  });

  it('refuses to enqueue a job while pg-boss is not running', async () => {
    const queue = new PgBossService(env);

    expect(queue.isRunning()).toBe(false);
    await expect(
      queue.sendJob('vynor.messages.outbound', {}, { singletonKey: 'outbox:x' }),
    ).rejects.toThrow('pg-boss is not running');
    await expect(queue.send('vynor.messages.outbound', {}, { key: 'outbox-x' })).rejects.toThrow(
      'pg-boss is not running',
    );
  });

  it('refuses to enqueue a job while BullMQ has not started', async () => {
    const queue = new BullMqJobQueue(env);

    expect(queue.isRunning()).toBe(false);
    await expect(queue.send('vynor.messages.outbound', {}, { key: 'outbox-x' })).rejects.toThrow(
      'BullMQ is not running',
    );
  });

  it('leaves events PENDING, unclaimed and with no attempt used while the job queue is not running', async () => {
    const event = await createEvent();
    const dispatcher = new OutboxDispatcherService(new BullMqJobQueue(env));

    await expect(dispatcher.pollAndDispatch()).resolves.toBe(0);

    const stored = await reload(event.id);
    expect(stored.status).toBe('PENDING');
    expect(stored.retryCount).toBe(0);
    expect(stored.claimedBy).toBeNull();
    expect(stored.dispatchedAt).toBeNull();
  });

  it('returns a failed send to PENDING with the error, and dead-letters it on the last attempt', async () => {
    const fresh = await createEvent();
    const lastAttempt = await createEvent(4);
    const dispatcher = new OutboxDispatcherService(
      runningQueue(() => Promise.reject(new Error('connection terminated'))),
    );

    await expect(dispatcher.pollAndDispatch()).resolves.toBe(0);

    const retried = await reload(fresh.id);
    expect(retried.status).toBe('PENDING');
    expect(retried.retryCount).toBe(1);
    expect(retried.lastError).toBe('connection terminated');
    expect(retried.dispatchedAt).toBeNull();

    const deadLettered = await reload(lastAttempt.id);
    expect(deadLettered.status).toBe('DEAD_LETTER');
    expect(deadLettered.retryCount).toBe(5);
  });

  it('completes an event once the queue holds its job, under the key outbox-<eventId>', async () => {
    const event = await createEvent();
    const queue = runningQueue(async () => undefined);
    const dispatcher = new OutboxDispatcherService(queue);

    await expect(dispatcher.pollAndDispatch()).resolves.toBe(1);

    const stored = await reload(event.id);
    expect(stored.status).toBe('COMPLETED');
    expect(stored.dispatchedAt).not.toBeNull();
    expect(queue.send).toHaveBeenCalledWith(
      'vynor.messages.outbound',
      expect.objectContaining({ jobId: event.id }),
      { key: `outbox-${event.id}` },
    );
  });

  it('returns claimed events it did not hand over to PENDING, attempts unchanged, once the queue stops', async () => {
    const events = [await createEvent(), await createEvent(1), await createEvent(2)];
    let running = true;
    const queue = {
      isRunning: () => running,
      // The first send fails as Redis disappears; the queue then reports it is not running.
      send: vi.fn(async () => {
        running = false;
        throw new Error('Connection is closed.');
      }),
    } as unknown as JobQueue;
    const dispatcher = new OutboxDispatcherService(queue);

    await expect(dispatcher.pollAndDispatch()).resolves.toBe(0);

    expect(queue.send).toHaveBeenCalledTimes(1);
    const stored = await Promise.all(events.map((event) => reload(event.id)));
    for (const row of stored) {
      expect(row.status).toBe('PENDING');
      expect(row.claimLeaseExpiresAt).toBeNull();
    }
    // Only the event whose send failed used an attempt; the others were released unclaimed.
    const [failed, ...released] = stored.sort((a, b) => (a.lastError ? -1 : b.lastError ? 1 : 0));
    expect(failed?.lastError).toBe('Connection is closed.');
    expect(failed?.retryCount).toBe(1);
    expect(released.map((row) => [row.retryCount, row.claimedBy, row.lastError])).toEqual(
      expect.arrayContaining([
        [1, null, null],
        [2, null, null],
      ]),
    );
    expect(released).toHaveLength(2);
  });
});
