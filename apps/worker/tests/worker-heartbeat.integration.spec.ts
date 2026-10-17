import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@vynor/database';
import { HEARTBEAT_MAX_AGE_MS, isHeartbeatFresh, writeHeartbeat } from '../src/health/heartbeat.js';
import {
  DB_PING_TIMEOUT_MS,
  WorkerHeartbeatService,
} from '../src/health/worker-heartbeat.service.js';
import type { PgBossService } from '../src/queue/pg-boss.service.js';

/**
 * The container health check must fail when the worker's event loop stops, it loses the
 * database or pg-boss is not running, instead of always passing. The service pings the test
 * database (DATABASE_URL); pg-boss is a stub.
 */

function queueStub(running: boolean): PgBossService {
  return { isRunning: () => running } as unknown as PgBossService;
}

const HEALTHCHECK_SCRIPT = fileURLToPath(new URL('../src/healthcheck.ts', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'vynor-heartbeat-'));
  file = join(dir, 'vynor-worker.heartbeat');
});

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('worker heartbeat file', () => {
  it('is fresh for up to three missed beats, then stale', async () => {
    const writtenAt = Date.now();
    await writeHeartbeat(file, writtenAt);

    await expect(isHeartbeatFresh(file, writtenAt)).resolves.toBe(true);
    await expect(isHeartbeatFresh(file, writtenAt + HEARTBEAT_MAX_AGE_MS)).resolves.toBe(true);
    await expect(isHeartbeatFresh(file, writtenAt + HEARTBEAT_MAX_AGE_MS + 1)).resolves.toBe(false);
  });

  it('is not fresh when missing or unreadable', async () => {
    await expect(isHeartbeatFresh(file)).resolves.toBe(false);
    await writeFile(file, 'not-a-timestamp');
    await expect(isHeartbeatFresh(file)).resolves.toBe(false);
  });
});

describe('WorkerHeartbeatService.beat', () => {
  const service = new WorkerHeartbeatService(queueStub(true));

  it('writes a heartbeat while the database answers', async () => {
    await expect(service.beat(file)).resolves.toBe(true);
    await expect(isHeartbeatFresh(file)).resolves.toBe(true);
  });

  it('lets the heartbeat go stale when the database query fails', async () => {
    const lastBeat = Date.now() - HEARTBEAT_MAX_AGE_MS;
    await writeHeartbeat(file, lastBeat);
    vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('connection refused'));

    await expect(service.beat(file)).resolves.toBe(false);
    await expect(isHeartbeatFresh(file, lastBeat + HEARTBEAT_MAX_AGE_MS + 1)).resolves.toBe(false);
  });

  it('lets the heartbeat go stale when the database does not answer in time', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.spyOn(prisma, '$queryRaw').mockReturnValueOnce(new Promise(() => {}) as never);

    const beat = service.beat(file);
    await vi.advanceTimersByTimeAsync(DB_PING_TIMEOUT_MS);

    await expect(beat).resolves.toBe(false);
    await expect(isHeartbeatFresh(file)).resolves.toBe(false);
  });

  it('writes no heartbeat while pg-boss is not running, even though the database answers', async () => {
    const withoutQueue = new WorkerHeartbeatService(queueStub(false));

    await expect(withoutQueue.beat(file)).resolves.toBe(false);
    await expect(isHeartbeatFresh(file)).resolves.toBe(false);
  });
});

describe('healthcheck script', () => {
  /** Runs the health check with its heartbeat in `dir` (os.tmpdir() honours TMPDIR). */
  function runHealthcheck(): number | null {
    return spawnSync(process.execPath, ['--import', 'tsx', HEALTHCHECK_SCRIPT], {
      cwd: REPO_ROOT,
      env: { ...process.env, TMPDIR: dir },
      timeout: 15_000,
    }).status;
  }

  it('fails without a fresh heartbeat and passes with one', async () => {
    expect(runHealthcheck()).toBe(1);

    await writeHeartbeat(file, Date.now() - HEARTBEAT_MAX_AGE_MS - 1_000);
    expect(runHealthcheck()).toBe(1);

    await writeHeartbeat(file);
    expect(runHealthcheck()).toBe(0);
  });
});
