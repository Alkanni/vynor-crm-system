import { request as httpRequest } from 'node:http';
import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Module, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { ActorContext, RealtimeResyncInstruction } from '@vynor/contracts';
import { io, type Socket as ClientSocket } from 'socket.io-client';
import { ActorContextService } from '../src/iam/actor-context.service.js';
import { JwtVerifierService } from '../src/iam/jwt-verifier.service.js';
import { isAllowedRealtimeOrigin } from '../src/realtime/realtime-origin.js';
import { RealtimeGateway } from '../src/realtime/realtime.gateway.js';

/**
 * VYN-02-02: the realtime gateway only accepts browsers from CORS_ALLOWED_ORIGINS (the REST list)
 * and still requires the JWT handshake and workspace membership. Real Socket.IO server and client
 * over HTTP; the JWT verifier and the membership lookup are fakes, so no database is used.
 */

const ALLOWED = 'https://crm.vynor.test';
const FOREIGN = 'https://evil.example';
const VALID_TOKEN = 'valid-token';
const WORKSPACE = 'ws_allowed';

const actor = {
  user: { id: 'usr_realtime_origin' },
  workspace: { id: WORKSPACE },
  permissions: [],
} as unknown as ActorContext;

const jwtVerifier = {
  verify: async (token: string) => {
    if (token !== VALID_TOKEN) throw new Error('invalid token');
    return { sub: 'auth_user_1' };
  },
};
const actorContextService = {
  resolveActorContext: async (_authId: string, workspaceId: string) => {
    if (workspaceId !== WORKSPACE) throw new Error('no membership');
    return actor;
  },
};

type Transport = 'websocket' | 'polling';
type Outcome =
  | { kind: 'resync'; resync: RealtimeResyncInstruction }
  | { kind: 'auth_error'; code: string; disconnect: string }
  | { kind: 'connect_error'; message: string };

let app: INestApplication;
let baseUrl: string;
const clients: ClientSocket[] = [];

function client(options: {
  transport: Transport;
  origin?: string;
  auth?: Record<string, unknown>;
  reconnection?: boolean;
}): ClientSocket {
  const socket = io(`${baseUrl}/realtime`, {
    transports: [options.transport],
    extraHeaders: options.origin ? { origin: options.origin } : {},
    auth: options.auth ?? { accessToken: VALID_TOKEN, workspaceId: WORKSPACE },
    reconnection: options.reconnection ?? false,
    reconnectionDelay: 50,
    reconnectionDelayMax: 50,
    reconnectionAttempts: 2,
    forceNew: true,
  });
  clients.push(socket);
  return socket;
}

function outcome(socket: ClientSocket): Promise<Outcome> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no handshake outcome within 5s')), 5000);
    const done = (value: Outcome) => {
      clearTimeout(timer);
      resolve(value);
    };
    socket.once('resync', (resync: RealtimeResyncInstruction) => done({ kind: 'resync', resync }));
    socket.once('auth:error', (error: { code: string }) =>
      socket.once('disconnect', (reason) =>
        done({ kind: 'auth_error', code: error.code, disconnect: reason }),
      ),
    );
    socket.once('connect_error', (error) =>
      done({ kind: 'connect_error', message: error.message }),
    );
  });
}

/** Raw Engine.IO polling handshake, to read the status and CORS headers the server answers. */
function pollingHandshake(origin: string): Promise<{ status: number; allowOrigin?: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      `${baseUrl}/socket.io/?EIO=4&transport=polling`,
      { headers: { origin } },
      (res) => {
        res.resume();
        const header = res.headers['access-control-allow-origin'];
        resolve({
          status: res.statusCode ?? 0,
          ...(header ? { allowOrigin: String(header) } : {}),
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

beforeAll(async () => {
  // The gateway reads CORS_ALLOWED_ORIGINS through the validated API env when clients connect.
  vi.stubEnv('CORS_ALLOWED_ORIGINS', `http://localhost:3000, ${ALLOWED}`);
  for (const [key, value] of Object.entries({
    DATABASE_URL: 'postgresql://unused',
    DIRECT_URL: 'postgresql://unused',
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    SUPABASE_JWT_SECRET: 'jwt-secret-for-integration-tests-0123456789',
    STORAGE_ACCESS_KEY_ID: 'key',
    STORAGE_SECRET_ACCESS_KEY: 'secret',
    // This spec does not use the shared state store.
    SHARED_STATE_STORE: 'memory',
  })) {
    if (process.env[key] === undefined) vi.stubEnv(key, value);
  }

  // Only the gateway and its two collaborators, not the whole API DI graph.
  Reflect.defineMetadata(
    'design:paramtypes',
    [JwtVerifierService, ActorContextService],
    RealtimeGateway,
  );
  class RealtimeOriginTestModule {}
  Module({
    providers: [
      RealtimeGateway,
      { provide: JwtVerifierService, useValue: jwtVerifier },
      { provide: ActorContextService, useValue: actorContextService },
    ],
  })(RealtimeOriginTestModule);

  app = await NestFactory.create(RealtimeOriginTestModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
});

afterAll(async () => {
  for (const socket of clients) socket.disconnect();
  await app?.close();
  vi.unstubAllEnvs();
});

describe('isAllowedRealtimeOrigin', () => {
  const allowed = ['http://localhost:3000', ALLOWED];

  it('accepts listed origins and requests without an Origin header', () => {
    expect(isAllowedRealtimeOrigin(ALLOWED, allowed)).toBe(true);
    expect(isAllowedRealtimeOrigin(undefined, allowed)).toBe(true);
  });

  it('refuses other origins, including look-alikes and the opaque "null" origin', () => {
    for (const origin of [FOREIGN, `${ALLOWED}.evil.example`, 'http://crm.vynor.test', 'null']) {
      expect(isAllowedRealtimeOrigin(origin, allowed)).toBe(false);
    }
  });
});

describe('realtime gateway origin and handshake', () => {
  it.each<Transport>(['websocket', 'polling'])(
    'lets an allowed origin connect over %s and join its workspace',
    async (transport) => {
      const result = await outcome(client({ transport, origin: ALLOWED }));

      expect(result).toMatchObject({
        kind: 'resync',
        resync: { reason: 'INITIAL_CONNECTION', workspaceId: WORKSPACE },
      });
    },
  );

  it.each<Transport>(['websocket', 'polling'])(
    'refuses a foreign origin over %s before the handshake',
    async (transport) => {
      const result = await outcome(client({ transport, origin: FOREIGN }));

      expect(result.kind).toBe('connect_error');
    },
  );

  it('answers polling with CORS headers for allowed origins only', async () => {
    await expect(pollingHandshake(ALLOWED)).resolves.toEqual({ status: 200, allowOrigin: ALLOWED });
    const foreign = await pollingHandshake(FOREIGN);
    expect(foreign.status).toBe(403);
    expect(foreign.allowOrigin).toBeUndefined();
  });

  it('accepts a non-browser client without Origin, still behind the JWT handshake', async () => {
    await expect(outcome(client({ transport: 'websocket' }))).resolves.toMatchObject({
      kind: 'resync',
    });
    await expect(
      outcome(
        client({ transport: 'websocket', auth: { accessToken: 'forged', workspaceId: WORKSPACE } }),
      ),
    ).resolves.toMatchObject({ kind: 'auth_error', code: 'TOKEN_INVALID' });
  });

  it('still rejects an allowed origin without a valid JWT or workspace membership', async () => {
    const missing = await outcome(
      client({ transport: 'websocket', origin: ALLOWED, auth: { workspaceId: WORKSPACE } }),
    );
    const invalid = await outcome(
      client({
        transport: 'websocket',
        origin: ALLOWED,
        auth: { accessToken: 'expired', workspaceId: WORKSPACE },
      }),
    );
    const foreignWorkspace = await outcome(
      client({
        transport: 'websocket',
        origin: ALLOWED,
        auth: { accessToken: VALID_TOKEN, workspaceId: 'ws_other' },
      }),
    );

    expect(missing).toEqual({
      kind: 'auth_error',
      code: 'TOKEN_MISSING',
      disconnect: 'io server disconnect',
    });
    expect(invalid).toMatchObject({ kind: 'auth_error', code: 'TOKEN_INVALID' });
    expect(foreignWorkspace).toMatchObject({ kind: 'auth_error', code: 'WORKSPACE_ACCESS_DENIED' });
  });

  it('reconnects an allowed origin after the connection drops', async () => {
    const socket = client({ transport: 'websocket', origin: ALLOWED, reconnection: true });
    await expect(outcome(socket)).resolves.toMatchObject({ kind: 'resync' });

    const reconnected = new Promise<number>((resolve) => socket.io.once('reconnect', resolve));
    const resyncAgain = outcome(socket);
    socket.io.engine.close(); // what a network drop looks like to the client

    await expect(reconnected).resolves.toBeGreaterThanOrEqual(1);
    await expect(resyncAgain).resolves.toMatchObject({
      kind: 'resync',
      resync: { workspaceId: WORKSPACE },
    });
  });

  it('keeps refusing a foreign origin on every reconnection attempt', async () => {
    const socket = client({ transport: 'websocket', origin: FOREIGN, reconnection: true });
    let connected = false;
    socket.on('connect', () => {
      connected = true;
    });

    await new Promise<void>((resolve) => socket.io.once('reconnect_failed', () => resolve()));

    expect(connected).toBe(false);
  });
});
