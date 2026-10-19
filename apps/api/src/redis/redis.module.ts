import {
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { sharedStateStore, type ApiEnv, type SubsystemHealth } from '@vynor/contracts';
import { checkRedisHealth } from '@vynor/observability';
import type { Redis } from 'ioredis';
import { API_ENV } from '../config/api-env.js';
import {
  IdempotencyStore,
  MemoryIdempotencyStore,
  RedisIdempotencyStore,
} from './idempotency-store.js';
import { MemoryRateLimitStore, RateLimitStore, RedisRateLimitStore } from './rate-limit-store.js';
import { createRedisClient, REDIS_CLIENT } from './redis-client.js';

/** How long startup waits for the first connection before serving (readiness stays DOWN). */
const STARTUP_CONNECT_WAIT_MS = 5_000;

/** Redis readiness indicator; nothing to check while the state lives in process memory. */
@Injectable()
export class RedisHealthIndicator {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | null) {}

  async check(): Promise<SubsystemHealth | undefined> {
    return this.redis ? checkRedisHealth(this.redis) : undefined;
  }
}

/** Waits briefly for the first connection at startup and closes the client on shutdown. */
@Injectable()
class RedisConnectionLifecycle implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('Redis');

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | null) {}

  async onModuleInit(): Promise<void> {
    const redis = this.redis;
    if (!redis || redis.status === 'ready') return;
    const ready = await new Promise<boolean>((resolve) => {
      const onReady = () => {
        clearTimeout(timer);
        resolve(true);
      };
      const timer = setTimeout(() => {
        redis.off('ready', onReady);
        resolve(false);
      }, STARTUP_CONNECT_WAIT_MS);
      redis.once('ready', onReady);
    });
    if (!ready) {
      this.logger.warn(
        'Redis is not reachable yet; requests that need it answer 503 and readiness reports DOWN until it is',
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }
}

/**
 * State every API instance must share (WU-04, DEC-04): Idempotency-Key records and the web
 * chat rate limits. Redis by default; SHARED_STATE_STORE=memory keeps them in this process,
 * which the environment schema only allows for local and test profiles.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [API_ENV],
      useFactory: (env: ApiEnv): Redis | null => {
        if (sharedStateStore(env) === 'redis') return createRedisClient(env.REDIS_URL!);
        new Logger('Redis').warn(
          'SHARED_STATE_STORE=memory: idempotency keys and web chat rate limits are kept in this process only (local/test)',
        );
        return null;
      },
    },
    {
      provide: IdempotencyStore,
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis | null): IdempotencyStore =>
        redis ? new RedisIdempotencyStore(redis) : new MemoryIdempotencyStore(),
    },
    {
      provide: RateLimitStore,
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis | null): RateLimitStore =>
        redis ? new RedisRateLimitStore(redis) : new MemoryRateLimitStore(),
    },
    RedisHealthIndicator,
    RedisConnectionLifecycle,
  ],
  exports: [REDIS_CLIENT, IdempotencyStore, RateLimitStore, RedisHealthIndicator],
})
export class RedisModule {}
