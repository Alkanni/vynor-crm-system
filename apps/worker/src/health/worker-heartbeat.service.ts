import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { prisma } from '@vynor/database';
import { createLogger, type Logger } from '@vynor/observability';
import { PgBossService } from '../queue/pg-boss.service.js';
import {
  clearHeartbeat,
  HEARTBEAT_FILE,
  HEARTBEAT_INTERVAL_MS,
  writeHeartbeat,
} from './heartbeat.js';

/** A database ping slower than this counts as unreachable. */
export const DB_PING_TIMEOUT_MS = 5_000;

/**
 * Writes the heartbeat that the container health check reads, but only while pg-boss is running
 * and the database answers. A blocked event loop stops the timer, and a stopped pg-boss or a lost
 * database stops the writes, so in each case the heartbeat goes stale and the container turns
 * unhealthy.
 */
@Injectable()
export class WorkerHeartbeatService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: Logger;
  private timer: NodeJS.Timeout | null = null;
  /** Last reported state, so only changes are logged instead of every beat. */
  private healthy: boolean | null = null;

  constructor(private readonly queue: PgBossService) {
    this.logger = createLogger({ service: 'vynor-worker' });
  }

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    // A heartbeat left by a previous process in this container must not count for this one.
    await clearHeartbeat();
    void this.beat();
    this.timer = setInterval(() => {
      void this.beat();
    }, HEARTBEAT_INTERVAL_MS);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await clearHeartbeat();
  }

  /** Writes a heartbeat if pg-boss is running and the database answers a ping in time. */
  async beat(file = HEARTBEAT_FILE): Promise<boolean> {
    try {
      // pg-boss is not restarted after a failed start, so without it this worker can do no work.
      if (!this.queue.isRunning()) throw new Error('pg-boss is not running');
      await withTimeout(prisma.$queryRaw`SELECT 1`, DB_PING_TIMEOUT_MS);
      await writeHeartbeat(file);
      this.report(true);
      return true;
    } catch (err) {
      this.report(false, err);
      return false;
    }
  }

  private report(healthy: boolean, err?: unknown): void {
    if (healthy === this.healthy) return;
    this.healthy = healthy;
    if (healthy) {
      this.logger.info({ correlationId: 'worker_heartbeat' }, 'Worker heartbeat healthy');
    } else {
      this.logger.warn(
        {
          correlationId: 'worker_heartbeat',
          err: { message: err instanceof Error ? err.message : String(err) },
        },
        'Worker heartbeat skipped; the container turns unhealthy if this persists',
      );
    }
  }
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Database did not answer within ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
