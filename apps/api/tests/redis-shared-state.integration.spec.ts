import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Body, Controller, Post } from '@nestjs/common';
import { createSuccessEnvelope, IDEMPOTENCY_HEADER } from '@vynor/contracts';
import { createTestPrismaClient, type PrismaClient } from '@vynor/database';
import { Redis } from 'ioredis';
import { apiError } from '../src/common/errors/api-error.js';
import { HealthController } from '../src/health/health.controller.js';
import { Public } from '../src/iam/decorators.js';
import { idempotencyRecordKey } from '../src/redis/idempotency-store.js';
import { rateLimitKey } from '../src/redis/rate-limit-store.js';
import { WebchatController } from '../src/webchat/webchat.controller.js';
import { WebchatService } from '../src/webchat/webchat.service.js';
import {
  createChannel,
  createTenant,
  removeTenants,
  uniqueSuffix,
  type Tenant,
} from './support/fixtures.js';
import {
  http,
  startHttpApp,
  testApiEnv,
  testRedisUrl,
  type HttpApp,
  type HttpResult,
} from './support/http-app.js';
import { startTcpProxy, type TcpProxy } from './support/tcp-proxy.js';

/**
 * WU-04 (VYN-04-01..03): Idempotency-Key records and the web chat rate limits held in Redis,
 * exercised through two API instances (separate Nest apps, each with its own Redis client)
 * that share one Redis, the way two API containers behind a load balancer do. A third
 * instance reaches Redis through a TCP relay the spec takes down and brings back, to check
 * fail closed (DEC-04), readiness and reconnection. Needs TEST_REDIS_URL and the test database.
 */

const calls: unknown[] = [];
let gate: Promise<void> = Promise.resolve();
let failuresLeft = 0;

@Controller('idempotency-probe')
class IdempotencyProbeController {
  @Public()
  @Post()
  async create(@Body() body: unknown) {
    calls.push(body);
    await gate;
    if (failuresLeft > 0) {
      failuresLeft -= 1;
      throw apiError(503, 'PROBE_UNAVAILABLE', 'The probe failed on purpose.');
    }
    return createSuccessEnvelope({ call: calls.length, body });
  }
}

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
}
interface Session {
  visitorId: string;
  visitorToken: string;
}
interface Readiness {
  status: string;
  checks: { database: { status: string }; redis?: { status: string; error?: string } };
}

const env = testApiEnv();
const controllers = [IdempotencyProbeController, WebchatController, HealthController];
const providers = [WebchatService];

describe('Shared state across two API instances (WU-04)', () => {
  let db: PrismaClient;
  let redis: Redis;
  let tenant: Tenant;
  let instanceA: HttpApp;
  let instanceB: HttpApp;
  const widgetKey = `wu04-widget-${uniqueSuffix()}`;
  let ipSeq = 10;
  const nextIp = () => `198.51.100.${ipSeq++}`;

  const key = (label: string) => `${label}-${uniqueSuffix()}`;
  const post = (app: HttpApp, idempotencyKey: string | null, body: unknown) =>
    http<{ data: { call: number; body: unknown } } | ErrorBody>(
      `${app.baseUrl}/idempotency-probe`,
      {
        method: 'POST',
        body,
        headers: idempotencyKey ? { [IDEMPOTENCY_HEADER]: idempotencyKey } : {},
      },
    );
  const session = (app: HttpApp, ip: string) =>
    http<{ data: Session } | ErrorBody>(`${app.baseUrl}/webchat/${widgetKey}/sessions`, {
      method: 'POST',
      body: {},
      headers: { 'x-forwarded-for': ip },
    });
  const postMessage = (app: HttpApp, ip: string, visitor: Session) =>
    http<{ data: { accepted: boolean } } | ErrorBody>(
      `${app.baseUrl}/webchat/${widgetKey}/messages`,
      {
        method: 'POST',
        headers: { 'x-forwarded-for': ip, 'x-visitor-token': visitor.visitorToken },
        body: {
          visitorId: visitor.visitorId,
          clientMessageId: `wu04_${uniqueSuffix()}`,
          text: 'Halo, toko buka?',
        },
      },
    );
  const readiness = (app: HttpApp) => http<Readiness>(`${app.baseUrl}/health/ready`);
  const code = (result: HttpResult<unknown>) => (result.body as ErrorBody).code;

  beforeAll(async () => {
    db = createTestPrismaClient();
    redis = new Redis(testRedisUrl());
    tenant = await createTenant(db, 'wu04');
    await createChannel(db, tenant, {
      channelType: 'WEBCHAT',
      provider: 'WEBCHAT_EMBED',
      name: 'Chat WU-04',
      webhookKey: widgetKey,
      config: { inboundMode: 'WEBHOOK' },
    });
    instanceA = await startHttpApp({ env, controllers, providers });
    instanceB = await startHttpApp({ env, controllers, providers });
  });

  beforeEach(() => {
    calls.length = 0;
    gate = Promise.resolve();
    failuresLeft = 0;
  });

  afterAll(async () => {
    await instanceA?.close();
    await instanceB?.close();
    redis?.disconnect();
    if (!db) return;
    await removeTenants(db, tenant ? [tenant] : [], []);
    await db.$disconnect();
  });

  describe('Idempotency-Key (VYN-04-02)', () => {
    it('replays on instance B the response instance A stored, and B rejects another payload', async () => {
      const k = key('replay');
      const original = await post(instanceA, k, { amount: 1 });
      expect(original.status).toBe(201);
      expect(original.headers.get('x-idempotent-replay')).toBeNull();

      const replay = await post(instanceB, k, { amount: 1 });
      expect(replay.status).toBe(201);
      expect(replay.headers.get('x-idempotent-replay')).toBe('true');
      expect(replay.body).toEqual(original.body);

      const conflict = await post(instanceB, k, { amount: 2 });
      expect([conflict.status, code(conflict)]).toEqual([422, 'IDEMPOTENCY_KEY_REUSED']);
      expect(calls).toEqual([{ amount: 1 }]);
    });

    it('answers 409 on B while the request still runs on A, then B replays it', async () => {
      const k = key('inflight');
      let release!: () => void;
      gate = new Promise((resolve) => (release = resolve));

      const pending = post(instanceA, k, { amount: 5 });
      await vi.waitFor(() => expect(calls).toHaveLength(1));
      const concurrent = await post(instanceB, k, { amount: 5 });
      expect([concurrent.status, code(concurrent)]).toEqual([409, 'IDEMPOTENCY_CONFLICT']);

      release();
      const completed = await pending;
      expect(completed.status).toBe(201);
      const replay = await post(instanceB, k, { amount: 5 });
      expect(replay.headers.get('x-idempotent-replay')).toBe('true');
      expect(replay.body).toEqual(completed.body);
      expect(calls).toHaveLength(1);
    });

    it('runs the handler once when the same key reaches both instances at the same time', async () => {
      const k = key('race');
      let release!: () => void;
      gate = new Promise((resolve) => (release = resolve));

      const settled: HttpResult<unknown>[] = [];
      const requests = Array.from({ length: 10 }, (_, i) =>
        post(i % 2 === 0 ? instanceA : instanceB, k, { amount: 9 }).then((result) => {
          settled.push(result);
          return result;
        }),
      );
      // Everything but the request that won the claim is answered while that one still runs.
      await vi.waitFor(() => expect(settled).toHaveLength(9));
      release();
      const results = await Promise.all(requests);

      const ran = results.filter((r) => r.status === 201);
      expect(ran).toHaveLength(1);
      expect(ran[0]!.headers.get('x-idempotent-replay')).toBeNull();
      expect(settled.slice(0, 9).map((r) => [r.status, code(r)])).toEqual(
        Array.from({ length: 9 }, () => [409, 'IDEMPOTENCY_CONFLICT']),
      );
      expect(calls).toHaveLength(1);
      for (const app of [instanceA, instanceB]) {
        const replay = await post(app, k, { amount: 9 });
        expect(replay.headers.get('x-idempotent-replay')).toBe('true');
        expect(replay.body).toEqual(ran[0]!.body);
      }
    });

    it('frees the key when the request fails on A, so the retry runs on B', async () => {
      const k = key('failure');
      failuresLeft = 1;
      const failed = await post(instanceA, k, { amount: 7 });
      expect([failed.status, code(failed)]).toEqual([503, 'PROBE_UNAVAILABLE']);

      const retried = await post(instanceB, k, { amount: 7 });
      expect(retried.status).toBe(201);
      expect(retried.headers.get('x-idempotent-replay')).toBeNull();
      expect(calls).toHaveLength(2);
    });

    it('keeps records under hashed keys with a TTL, with no client key or path in Redis', async () => {
      const k = key('stored');
      await post(instanceA, k, { amount: 3 });

      const recordKey = idempotencyRecordKey('global', 'POST', '/api/v1/idempotency-probe', k);
      expect(recordKey).toMatch(/^vynor:idem:global:[0-9a-f]{64}$/);
      const ttl = await redis.pttl(recordKey);
      expect(ttl).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(ttl).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
      const stored = JSON.parse((await redis.get(recordKey))!) as Record<string, unknown>;
      expect(stored).toMatchObject({ status: 'COMPLETED', response: { statusCode: 201 } });
      expect(stored.fingerprint).toMatch(/^[0-9a-f]{64}$/);
      expect(await redis.keys(`*${k}*`)).toEqual([]);
    });
  });

  describe('web chat rate limits (VYN-04-03)', () => {
    it('counts sessions on both instances in one window: the 21st is refused on either', async () => {
      const ip = nextIp();
      for (let i = 0; i < 20; i++) {
        const result = await session(i % 2 === 0 ? instanceA : instanceB, ip);
        expect(result.status, `session ${i + 1}`).toBe(200);
      }
      for (const app of [instanceA, instanceB]) {
        const limited = await session(app, ip);
        expect([limited.status, code(limited)]).toEqual([429, 'RATE_LIMITED']);
      }
      // Another client IP has its own window.
      expect((await session(instanceB, nextIp())).status).toBe(200);

      const counterKey = rateLimitKey('webchat-session', `${ip}:${widgetKey}`);
      expect(counterKey).toMatch(/^vynor:rl:webchat-session:[0-9a-f]{64}$/);
      expect(Number(await redis.get(counterKey))).toBe(22);
      expect(await redis.pttl(counterKey)).toBeGreaterThan(0);
      expect(await redis.keys(`*${ip}*`)).toEqual([]);
    });

    it('counts messages on both instances in one window: the 31st is refused', async () => {
      const ip = nextIp();
      const visitor = ((await session(instanceA, ip)).body as { data: Session }).data;
      for (let i = 0; i < 30; i++) {
        const result = await postMessage(i % 2 === 0 ? instanceA : instanceB, ip, visitor);
        expect(result.status, `message ${i + 1}`).toBe(202);
      }
      const limited = await postMessage(instanceB, ip, visitor);
      expect([limited.status, code(limited)]).toEqual([429, 'RATE_LIMITED']);
    });
  });

  describe('Redis outage and recovery (DEC-04 fail closed, VYN-04-01)', () => {
    let proxy: TcpProxy;
    let instanceC: HttpApp;

    beforeAll(async () => {
      const target = new URL(testRedisUrl());
      proxy = await startTcpProxy({ host: target.hostname, port: Number(target.port || 6379) });
      const viaProxy = new URL(target);
      viaProxy.hostname = '127.0.0.1';
      viaProxy.port = String(proxy.port);
      instanceC = await startHttpApp({
        env: testApiEnv({
          REDIS_URL: viaProxy.toString(),
          ENCRYPTION_MASTER_KEY: env.ENCRYPTION_MASTER_KEY!,
        }),
        controllers,
        providers,
      });
    });

    afterAll(async () => {
      await instanceC?.close();
      await proxy?.down();
    });

    it('refuses keyed requests and web chat with 503 while Redis is down, then recovers', async () => {
      const ready = await readiness(instanceC);
      expect([ready.status, ready.body.status, ready.body.checks.redis?.status]).toEqual([
        200,
        'UP',
        'UP',
      ]);
      const ip = nextIp();
      expect((await session(instanceC, ip)).status).toBe(200);

      await proxy.down();
      await vi.waitFor(async () => expect((await readiness(instanceC)).status).toBe(503), {
        timeout: 5_000,
      });
      const notReady = await readiness(instanceC);
      expect(notReady.body.status).toBe('DOWN');
      expect(notReady.body.checks.database.status).toBe('UP');
      expect(notReady.body.checks.redis?.status).toBe('DOWN');
      expect((await http(`${instanceC.baseUrl}/health/live`)).status).toBe(200);

      // Fail closed: the handler never runs and the limit is never skipped.
      const keyed = await post(instanceC, key('outage'), { amount: 4 });
      expect([keyed.status, code(keyed)]).toEqual([503, 'SERVICE_UNAVAILABLE']);
      expect(calls).toHaveLength(0);
      const limited = await session(instanceC, ip);
      expect([limited.status, code(limited)]).toEqual([503, 'SERVICE_UNAVAILABLE']);
      // A request without an Idempotency-Key does not need Redis.
      expect((await post(instanceC, null, { amount: 4 })).status).toBe(201);
      expect(calls).toHaveLength(1);

      await proxy.up();
      await vi.waitFor(async () => expect((await readiness(instanceC)).status).toBe(200), {
        timeout: 10_000,
        interval: 200,
      });
      const k = key('recovered');
      const first = await post(instanceC, k, { amount: 6 });
      expect(first.status).toBe(201);
      // Instance A, which never lost Redis, replays what C stored after reconnecting.
      const replay = await post(instanceA, k, { amount: 6 });
      expect(replay.headers.get('x-idempotent-replay')).toBe('true');
      expect(replay.body).toEqual(first.body);
      expect((await session(instanceC, ip)).status).toBe(200);
    }, 30_000);

    it('starts while Redis is unreachable, not ready and refusing keyed requests', async () => {
      const unreachable = await startHttpApp({
        // Nothing listens on port 9 (discard): the client never connects.
        env: testApiEnv({ REDIS_URL: 'redis://127.0.0.1:9/0' }),
        controllers,
        providers,
      });
      try {
        const ready = await readiness(unreachable);
        expect([ready.status, ready.body.checks.redis?.status]).toEqual([503, 'DOWN']);
        const keyed = await post(unreachable, key('boot'), { amount: 8 });
        expect([keyed.status, code(keyed)]).toEqual([503, 'SERVICE_UNAVAILABLE']);
        expect(calls).toHaveLength(0);
      } finally {
        await unreachable.close();
      }
    }, 30_000);
  });
});
