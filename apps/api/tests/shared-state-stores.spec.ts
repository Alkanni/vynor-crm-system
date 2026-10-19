import { afterAll, describe, expect, it, vi } from 'vitest';
import { Redis } from 'ioredis';
import {
  IdempotencyStore,
  MemoryIdempotencyStore,
  RedisIdempotencyStore,
} from '../src/redis/idempotency-store.js';
import {
  MemoryRateLimitStore,
  RateLimitStore,
  RedisRateLimitStore,
} from '../src/redis/rate-limit-store.js';
import { createRedisClient, describeRedisUrl } from '../src/redis/redis-client.js';
import { uniqueSuffix } from './support/fixtures.js';
import { testRedisUrl } from './support/http-app.js';
import { startTcpProxy } from './support/tcp-proxy.js';

/**
 * WU-04: the contract both store implementations keep. Redis is what every deployment runs
 * (TEST_REDIS_URL here); memory is the explicit local/test opt-in (SHARED_STATE_STORE=memory).
 */

const redis = new Redis(testRedisUrl());
afterAll(() => redis.disconnect());

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const response = { statusCode: 201, body: { data: { id: 'x' } } };

describe.each([
  ['Redis', () => new RedisIdempotencyStore(redis)],
  ['memory', () => new MemoryIdempotencyStore()],
] as [string, () => IdempotencyStore][])('%s idempotency store', (_name, create) => {
  const store = create();
  const key = () => `vynor:idem:spec:${uniqueSuffix()}`;

  it('lets exactly one claim win and shows the others its IN_FLIGHT record', async () => {
    const k = key();
    const claims = await Promise.all(
      Array.from({ length: 8 }, () => store.claim(k, 'fp-1', 10_000)),
    );
    expect(claims.filter((c) => c.claimed)).toHaveLength(1);
    for (const claim of claims.filter((c) => !c.claimed)) {
      expect(claim).toEqual({
        claimed: false,
        record: { status: 'IN_FLIGHT', fingerprint: 'fp-1' },
      });
    }
  });

  it('stores the response for the lease holder and returns it to later claims', async () => {
    const k = key();
    const claim = await store.claim(k, 'fp-1', 10_000);
    if (!claim.claimed) throw new Error('expected the first claim to win');
    expect(await store.complete(k, claim.lease, 'fp-1', response, 10_000)).toBe(true);
    expect(await store.claim(k, 'fp-2', 10_000)).toEqual({
      claimed: false,
      record: { status: 'COMPLETED', fingerprint: 'fp-1', response },
    });
  });

  it('ignores complete and release from a lease that no longer owns the key', async () => {
    const k = key();
    const stale = await store.claim(k, 'fp-1', 30);
    if (!stale.claimed) throw new Error('expected the first claim to win');
    await sleep(80);
    // The in-flight TTL ran out, so another request took the key.
    const current = await store.claim(k, 'fp-1', 10_000);
    expect(current.claimed).toBe(true);

    expect(await store.complete(k, stale.lease, 'fp-1', response, 10_000)).toBe(false);
    await store.release(k, stale.lease);
    expect(await store.claim(k, 'fp-1', 10_000)).toEqual({
      claimed: false,
      record: { status: 'IN_FLIGHT', fingerprint: 'fp-1' },
    });
  });

  it('frees the key on release by its lease holder', async () => {
    const k = key();
    const claim = await store.claim(k, 'fp-1', 10_000);
    if (!claim.claimed) throw new Error('expected the first claim to win');
    await store.release(k, claim.lease);
    expect((await store.claim(k, 'fp-1', 10_000)).claimed).toBe(true);
  });
});

describe.each([
  ['Redis', () => new RedisRateLimitStore(redis)],
  ['memory', () => new MemoryRateLimitStore()],
] as [string, () => RateLimitStore][])('%s rate limit store', (_name, create) => {
  const store = create();

  it('allows `limit` hits per window and starts a new window when it ends', async () => {
    const identity = `198.51.100.1:widget-${uniqueSuffix()}`;
    const window = async () => {
      const results: boolean[] = [];
      for (let i = 0; i < 4; i++) results.push(await store.hit('spec', identity, 3, 150));
      return results;
    };
    expect(await window()).toEqual([true, true, true, false]);
    await sleep(200);
    expect(await window()).toEqual([true, true, true, false]);
  });

  it('keeps separate windows per scope and identity', async () => {
    const identity = `198.51.100.2:widget-${uniqueSuffix()}`;
    expect(await store.hit('spec-a', identity, 1, 10_000)).toBe(true);
    expect(await store.hit('spec-a', identity, 1, 10_000)).toBe(false);
    expect(await store.hit('spec-b', identity, 1, 10_000)).toBe(true);
    expect(await store.hit('spec-a', `${identity}-other`, 1, 10_000)).toBe(true);
  });
});

describe('Redis client', () => {
  it('names its target without credentials', () => {
    expect(describeRedisUrl('redis://:s3cret@redis:6379/0')).toBe('redis:6379/0');
    expect(describeRedisUrl('rediss://user:s3cret@cache.internal')).toBe('cache.internal:6379/0');
  });

  it('logs an outage once and then the reconnection', async () => {
    const target = new URL(testRedisUrl());
    const proxy = await startTcpProxy({ host: target.hostname, port: Number(target.port || 6379) });
    const viaProxy = new URL(target);
    viaProxy.hostname = '127.0.0.1';
    viaProxy.port = String(proxy.port);
    const logger = { log: vi.fn(), warn: vi.fn() };
    const client = createRedisClient(viaProxy.toString(), logger as never);
    const name = describeRedisUrl(viaProxy.toString());
    try {
      await vi.waitFor(() => expect(client.status).toBe('ready'));
      expect(logger.log).toHaveBeenCalledWith(`Connected to Redis at ${name}`);

      await proxy.down();
      await vi.waitFor(() => expect(logger.warn).toHaveBeenCalled());
      // Reconnect attempts keep failing for a while; the outage is still reported once.
      await new Promise((resolve) => setTimeout(resolve, 800));
      const unreachable = logger.warn.mock.calls.filter(([message]) =>
        String(message).includes('is unreachable; reconnecting'),
      );
      expect(unreachable).toHaveLength(1);

      await proxy.up();
      await vi.waitFor(() => expect(client.status).toBe('ready'), { timeout: 5_000 });
      expect(logger.log).toHaveBeenLastCalledWith(`Reconnected to Redis at ${name}`);
    } finally {
      client.disconnect();
      await proxy.down();
    }
  });
});
