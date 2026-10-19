import { createHash } from 'node:crypto';
import type { Redis } from 'ioredis';
import { REDIS_KEY_PREFIX } from './redis-client.js';

/**
 * Fixed-window rate limits. A window starts with its first hit and lasts `windowMs`. `hit`
 * rejects when the store is unreachable; callers then fail closed (DEC-04).
 */
export abstract class RateLimitStore {
  /** Counts one hit for `identity` in `scope`; false once the window holds more than `limit`. */
  abstract hit(scope: string, identity: string, limit: number, windowMs: number): Promise<boolean>;
}

/** The identity (for example client IP + widget key) is hashed, so no IP is stored in Redis. */
export function rateLimitKey(scope: string, identity: string): string {
  return `${REDIS_KEY_PREFIX}rl:${scope}:${createHash('sha256').update(identity).digest('hex')}`;
}

// INCR and the expiry run as one atomic step, so a counter can never be left without a TTL.
const HIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 or redis.call('PTTL', KEYS[1]) < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return count`;

/** Counters shared by every API instance, so switching instances does not reset a limit. */
export class RedisRateLimitStore extends RateLimitStore {
  constructor(private readonly redis: Redis) {
    super();
  }

  async hit(scope: string, identity: string, limit: number, windowMs: number): Promise<boolean> {
    const count = await this.redis.eval(HIT_SCRIPT, 1, rateLimitKey(scope, identity), windowMs);
    return Number(count) <= limit;
  }
}

/** Per-process counters, for a single local or test process only (SHARED_STATE_STORE=memory). */
export class MemoryRateLimitStore extends RateLimitStore {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  async hit(scope: string, identity: string, limit: number, windowMs: number): Promise<boolean> {
    const key = rateLimitKey(scope, identity);
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt < now) {
      this.hits.set(key, { count: 1, resetAt: now + windowMs });
      if (this.hits.size > 10_000) this.hits.clear();
      return true;
    }
    entry.count += 1;
    return entry.count <= limit;
  }
}
