import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { QUEUE_CONFIGS, type QueueName } from '@vynor/contracts';
import { createLogger, type Logger } from '@vynor/observability';
import { PgBoss } from 'pg-boss';

@Injectable()
export class PgBossService implements OnModuleInit, OnModuleDestroy {
  private boss: PgBoss | null = null;
  private readonly logger: Logger;

  constructor() {
    this.logger = createLogger({
      service: 'vynor-worker',
      environment: process.env.NODE_ENV || 'development',
    });
  }

  async onModuleInit(): Promise<void> {
    const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
    if (!connectionString) {
      this.logger.warn(
        { correlationId: 'queue_init' },
        'DATABASE_URL not configured. pg-boss queue service skipped in current environment.',
      );
      return;
    }

    try {
      this.boss = new PgBoss({
        connectionString,
        schema: 'pgboss',
        max: 10,
      });

      this.boss.on('error', (err: Error) => {
        this.logger.error(
          {
            correlationId: 'pg_boss_error',
            err: { message: err.message, stack: err.stack },
          },
          'pg-boss background engine error encountered',
        );
      });

      await this.boss.start();
      this.logger.info(
        { correlationId: 'queue_init' },
        'pg-boss background queue engine initialized and started',
      );

      // Register named queues with their canonical configs (FND-051)
      for (const config of Object.values(QUEUE_CONFIGS)) {
        try {
          await this.boss.createQueue(config.name, {
            retryLimit: config.retryLimit,
            retryDelay: config.retryDelaySeconds,
          });
        } catch {
          // Queue may already exist; safe to ignore
        }
      }
    } catch (err) {
      this.logger.error(
        {
          correlationId: 'queue_init',
          err: { message: (err as Error).message },
        },
        'Failed to start pg-boss engine',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.boss) {
      this.logger.info(
        { correlationId: 'queue_shutdown' },
        'Gracefully stopping pg-boss worker...',
      );
      await this.boss.stop({ graceful: true, timeout: 15000 });
      this.boss = null;
    }
  }

  getClient(): PgBoss | null {
    return this.boss;
  }

  /**
   * Enqueue a job with a deterministic singleton key for idempotent dispatch (FND-059).
   */
  async sendJob(
    queue: QueueName,
    payload: Record<string, unknown>,
    options?: {
      singletonKey?: string;
      retryLimit?: number;
      retryDelay?: number;
      expireInSeconds?: number;
    },
  ): Promise<string | null> {
    if (!this.boss) {
      this.logger.warn(
        { correlationId: 'job_send_skipped', queue },
        'pg-boss client not available; job enqueuing skipped.',
      );
      return null;
    }

    const result = await this.boss.send(queue, payload, {
      ...(options?.singletonKey ? { singletonKey: options.singletonKey } : {}),
      ...(options?.retryLimit !== undefined ? { retryLimit: options.retryLimit } : {}),
      ...(options?.retryDelay !== undefined ? { retryDelay: options.retryDelay } : {}),
      ...(options?.expireInSeconds !== undefined
        ? { expireInSeconds: options.expireInSeconds }
        : {}),
    });

    return result;
  }
}
