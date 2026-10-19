import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Body, Controller, Get, Post } from '@nestjs/common';
import { createSuccessEnvelope, IDEMPOTENCY_HEADER, type ActorContext } from '@vynor/contracts';
import { createTestPrismaClient, type PrismaClient } from '@vynor/database';
import { apiError } from '../src/common/errors/api-error.js';
import { CurrentActor, Public } from '../src/iam/decorators.js';
import {
  AGENT_PERMISSIONS,
  createMember,
  createTenant,
  removeTenants,
  uniqueSuffix,
  type Member,
  type Tenant,
} from './support/fixtures.js';
import { http, startHttpApp, testApiEnv, type HttpApp } from './support/http-app.js';

/**
 * WU-03 / VYN-03-03: the global IdempotencyInterceptor (main.ts) over real HTTP, driven by a
 * probe controller so the handler's timing is under the test's control. The store is the
 * interceptor's in-memory map (per process; DEC-04 moves it to Redis in WU-04).
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

  @Public()
  @Get()
  read() {
    calls.push('GET');
    return createSuccessEnvelope({ call: calls.length });
  }

  /** Not public: the caller's workspace is resolved, so keys are scoped to it. */
  @Post('authenticated')
  authenticated(@CurrentActor() actor: ActorContext, @Body() body: unknown) {
    calls.push(body);
    return createSuccessEnvelope({ call: calls.length, user: actor.user.displayName });
  }
}

interface ProbeBody {
  data: { call: number; body?: unknown; user?: string };
}
interface ErrorBody {
  code: string;
  message: string;
}

const env = testApiEnv();

describe('Idempotency-Key handling over HTTP (WU-03 characterization)', () => {
  let db: PrismaClient;
  let app: HttpApp;
  let url: string;
  const tenants: Tenant[] = [];
  const members: Member[] = [];
  let first: Member;
  let colleague: Member;
  let otherTenant: Member;

  const key = (label: string) => `${label}-${uniqueSuffix()}`;
  const post = (path: string, idempotencyKey: string | null, body: unknown, token?: string) =>
    http<ProbeBody | ErrorBody>(`${url}${path}`, {
      method: 'POST',
      body,
      ...(token ? { token } : {}),
      headers: idempotencyKey ? { [IDEMPOTENCY_HEADER]: idempotencyKey } : {},
    });

  beforeAll(async () => {
    db = createTestPrismaClient();
    const tenantA = await createTenant(db, 'idem-a');
    const tenantB = await createTenant(db, 'idem-b');
    tenants.push(tenantA, tenantB);
    first = await createMember(db, env, tenantA, 'Idem First', AGENT_PERMISSIONS);
    colleague = await createMember(db, env, tenantA, 'Idem Colleague', AGENT_PERMISSIONS);
    otherTenant = await createMember(db, env, tenantB, 'Idem Other', AGENT_PERMISSIONS);
    members.push(first, colleague, otherTenant);

    app = await startHttpApp({ env, withIam: true, controllers: [IdempotencyProbeController] });
    url = `${app.baseUrl}/idempotency-probe`;
  });

  beforeEach(() => {
    calls.length = 0;
    gate = Promise.resolve();
    failuresLeft = 0;
  });

  afterAll(async () => {
    await app?.close();
    if (!db) return;
    await removeTenants(db, tenants, members);
    await db.$disconnect();
  });

  it('replays the stored response for a repeated key without running the handler', async () => {
    const k = key('replay');
    const original = await post('', k, { amount: 1 });
    expect(original.status).toBe(201);
    expect(original.headers.get('x-idempotent-replay')).toBeNull();
    expect(original.body).toEqual({ data: { call: 1, body: { amount: 1 } } });

    const replay = await post('', k, { amount: 1 });
    expect(replay.status).toBe(201);
    expect(replay.headers.get('x-idempotent-replay')).toBe('true');
    expect(replay.body).toEqual(original.body);
    expect(calls).toHaveLength(1);
  });

  it('replays the first response even when the payload differs (no payload check)', async () => {
    const k = key('conflict');
    await post('', k, { amount: 1 });
    const different = await post('', k, { amount: 999 });
    // Current behaviour, reported as a bug in docs/migration/08 (WU-03): a reused key with a
    // different payload gets the first response instead of an error, and the new payload is
    // silently dropped.
    expect(different.status).toBe(201);
    expect(different.headers.get('x-idempotent-replay')).toBe('true');
    expect(different.body).toEqual({ data: { call: 1, body: { amount: 1 } } });
    expect(calls).toEqual([{ amount: 1 }]);
  });

  it('answers 409 IDEMPOTENCY_CONFLICT while the first request is still in flight', async () => {
    const k = key('inflight');
    let release!: () => void;
    gate = new Promise((resolve) => (release = resolve));

    const pending = post('', k, { amount: 5 });
    await vi.waitFor(() => expect(calls).toHaveLength(1));

    const concurrent = await post('', k, { amount: 5 });
    expect(concurrent.status).toBe(409);
    expect((concurrent.body as ErrorBody).code).toBe('IDEMPOTENCY_CONFLICT');

    release();
    const completed = await pending;
    expect(completed.status).toBe(201);
    const later = await post('', k, { amount: 5 });
    expect(later.headers.get('x-idempotent-replay')).toBe('true');
    expect(later.body).toEqual(completed.body);
    expect(calls).toHaveLength(1);
  });

  it('forgets a key whose request failed, so the retry runs again', async () => {
    const k = key('failure');
    failuresLeft = 1;
    const failed = await post('', k, { amount: 7 });
    expect(failed.status).toBe(503);
    expect((failed.body as ErrorBody).code).toBe('PROBE_UNAVAILABLE');

    const retried = await post('', k, { amount: 7 });
    expect(retried.status).toBe(201);
    expect(retried.headers.get('x-idempotent-replay')).toBeNull();
    expect(calls).toHaveLength(2);
  });

  it('rejects malformed keys with 400 and ignores keys on GET and keyless requests', async () => {
    for (const bad of ['short', 'has spaces in it', 'x'.repeat(129)]) {
      const response = await post('', bad, { amount: 1 });
      expect(response.status, bad).toBe(400);
      expect((response.body as ErrorBody).code, bad).toBe('BAD_REQUEST');
    }
    expect(calls).toHaveLength(0);

    const k = key('get');
    for (let i = 0; i < 2; i++) {
      await http(url, { headers: { [IDEMPOTENCY_HEADER]: k } });
    }
    await post('', null, { amount: 1 });
    await post('', null, { amount: 1 });
    expect(calls).toEqual(['GET', 'GET', { amount: 1 }, { amount: 1 }]);
  });

  it('scopes keys to the workspace (not the user), method and path', async () => {
    const k = key('scope');
    const mine = await post('/authenticated', k, { from: 'first' }, first.token);
    expect(mine.body).toEqual({ data: { call: 1, user: 'Idem First' } });

    // Same workspace, different user: gets the first user's stored response (reported in 08).
    const sameWorkspace = await post('/authenticated', k, { from: 'colleague' }, colleague.token);
    expect(sameWorkspace.headers.get('x-idempotent-replay')).toBe('true');
    expect(sameWorkspace.body).toEqual(mine.body);

    // Another workspace and another path each have their own entry.
    const elsewhere = await post('/authenticated', k, { from: 'other' }, otherTenant.token);
    expect(elsewhere.body).toEqual({ data: { call: 2, user: 'Idem Other' } });
    const otherPath = await post('', k, { from: 'public' });
    expect(otherPath.headers.get('x-idempotent-replay')).toBeNull();
    expect(calls).toHaveLength(3);
  });
});
