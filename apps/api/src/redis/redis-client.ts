import { Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

/** DI token for the Redis client shared state lives in, or null with SHARED_STATE_STORE=memory. */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/** Prefix of every key the API writes, so its keys stand apart in a shared Redis. */
export const REDIS_KEY_PREFIX = 'vynor:';

/** No single command waits longer than this; callers then fail closed. */
const COMMAND_TIMEOUT_MS = 2_000;
const CONNECT_TIMEOUT_MS = 5_000;
/** Reconnect attempts back off up to this delay and never stop. */
const MAX_RECONNECT_DELAY_MS = 2_000;
/** During an outage every reconnect attempt fails; log at most one of them per interval. */
const ERROR_LOG_INTERVAL_MS = 30_000;

/**
 * Client for the state API instances share (WU-04). Fail closed (DEC-04): while Redis is
 * unreachable, commands are rejected at once instead of waiting in an offline queue, and none
 * waits longer than the command timeout, so callers answer 503 instead of hanging. The client
 * keeps reconnecting in the background.
 */
export function createRedisClient(url: string, logger = new Logger('Redis')): Redis {
  const client = new Redis(url, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    commandTimeout: COMMAND_TIMEOUT_MS,
    connectTimeout: CONNECT_TIMEOUT_MS,
    retryStrategy: (attempt) => Math.min(attempt * 250, MAX_RECONNECT_DELAY_MS),
  });
  const target = describeRedisUrl(url);
  let lastErrorLoggedAt = 0;
  let unreachable = false;
  client.on('ready', () => {
    logger.log(`${unreachable ? 'Reconnected' : 'Connected'} to Redis at ${target}`);
    unreachable = false;
    lastErrorLoggedAt = 0;
  });
  // Emitted for every unplanned disconnect (never for quit), even when no connection attempt
  // fails with an error, so it is what marks an outage in the logs.
  client.on('reconnecting', () => {
    if (unreachable) return;
    unreachable = true;
    logger.warn(
      `Redis at ${target} is unreachable; reconnecting. Requests that need it answer 503 until then`,
    );
  });
  client.on('error', (err: Error) => {
    const now = Date.now();
    if (now - lastErrorLoggedAt < ERROR_LOG_INTERVAL_MS) return;
    lastErrorLoggedAt = now;
    logger.warn(`Redis at ${target} is unavailable: ${err.message}`);
  });
  return client;
}

/** host:port/db of a Redis URL, without credentials, for logs. */
export function describeRedisUrl(url: string): string {
  const parsed = new URL(url);
  const database = parsed.pathname.replace(/^\//, '') || '0';
  return `${parsed.hostname}:${parsed.port || '6379'}/${database}`;
}
