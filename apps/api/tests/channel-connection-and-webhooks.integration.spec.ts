import { createHmac, randomBytes } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ApiEnvSchema, type ActorContext } from '@vynor/contracts';
import { createTestPrismaClient, type PrismaClient } from '@vynor/database';
import type { WebhookRequest } from '@vynor/channel-adapters';
import type { AuditService } from '../src/audit/audit.service.js';
import { ChannelRuntimeService } from '../src/channels/channel-runtime.service.js';
import { ChannelsService } from '../src/channels/channels.service.js';
import { WebhookIngestService } from '../src/webhooks/webhook-ingest.service.js';

/**
 * Issue #37: connecting a channel against a (fake) provider, encrypted credential storage,
 * webhook registration, and webhook ingress into the provider event journal.
 * Runs against the test database (TEST_DATABASE_URL / DATABASE_URL) and only touches the
 * workspace it creates.
 */

const GRAPH = 'https://graph.mock.test';
const TELEGRAM = 'https://telegram.mock.test';
const PHONE_ID = '106540352242922';
const WABA_ID = '102290129340398';
const ACCESS_TOKEN = 'EAAGtestTokenForIntegrationSuite0123456789';
const APP_SECRET = 'abcdef0123456789abcdef0123456789';
const BOT_TOKEN = '7000000001:AAEexampleTOKENexampleTOKENexample12';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

interface ProviderCall {
  method: string;
  url: URL;
  body: unknown;
}

/** Stands in for the WhatsApp Cloud API and Telegram Bot API. */
function installFakeProviders(): ProviderCall[] {
  const calls: ProviderCall[] = [];
  vi.stubGlobal('fetch', async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = (init.method ?? 'GET').toUpperCase();
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ method, url, body });
    const auth = new Headers(init.headers).get('authorization') ?? '';

    if (url.origin === GRAPH) {
      if (auth.includes('BAD')) {
        return json(401, {
          error: { message: 'Error validating access token.', type: 'OAuthException', code: 190 },
        });
      }
      const path = url.pathname.replace(/^\/v\d+\.\d+\//, '');
      if (method === 'GET' && path === PHONE_ID) {
        return json(200, {
          id: PHONE_ID,
          display_phone_number: '+62 811-0000-1111',
          verified_name: 'Toko Uji',
        });
      }
      if (method === 'GET' && path === `${WABA_ID}/phone_numbers`) {
        return json(200, { data: [{ id: PHONE_ID }] });
      }
      if (method === 'POST' && (path === `${WABA_ID}/subscribed_apps` || path === PHONE_ID)) {
        return json(200, { success: true });
      }
    }
    if (url.origin === TELEGRAM) {
      const method = url.pathname.split('/').pop();
      if (method === 'getMe') {
        return json(200, {
          ok: true,
          result: { id: 7000000001, is_bot: true, first_name: 'Toko Bot', username: 'TokoBot' },
        });
      }
      if (method === 'deleteWebhook') return json(200, { ok: true, result: true });
    }
    return json(404, { error: { message: `No fake for ${method} ${url.href}` } });
  });
  return calls;
}

function buildRuntime(publicBaseUrl: string): ChannelRuntimeService {
  const env = ApiEnvSchema.parse({
    APP_ENV: 'test',
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://unused',
    DIRECT_URL: 'postgresql://unused',
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    SUPABASE_JWT_SECRET: 'jwt-secret-for-integration-tests-0123456789',
    STORAGE_ACCESS_KEY_ID: 'key',
    STORAGE_SECRET_ACCESS_KEY: 'secret',
    ENCRYPTION_MASTER_KEY: randomBytes(32).toString('base64'),
    PUBLIC_WEBHOOK_BASE_URL: publicBaseUrl,
    META_GRAPH_API_BASE_URL: GRAPH,
    TELEGRAM_API_BASE_URL: TELEGRAM,
  });
  return new ChannelRuntimeService(env);
}

function signedWhatsAppDelivery(text: string, wamid: string): WebhookRequest {
  const body = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: WABA_ID,
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '6281100001111', phone_number_id: PHONE_ID },
              contacts: [{ profile: { name: 'Siti Aminah' }, wa_id: '6281234567890' }],
              messages: [
                {
                  from: '6281234567890',
                  id: wamid,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: 'text',
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  });
  return {
    method: 'POST',
    rawBody: Buffer.from(body),
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': `sha256=${createHmac('sha256', APP_SECRET).update(body).digest('hex')}`,
    },
    query: {},
  };
}

describe('Channel connection and webhook ingress (issue #37)', () => {
  let db: PrismaClient;
  let actor: ActorContext;
  let providerCalls: ProviderCall[];
  const audit = { recordForActor: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const runtime = buildRuntime('https://crm.vynor.test');
  const channels = new ChannelsService(runtime, audit);
  const webhooks = new WebhookIngestService(runtime);

  beforeAll(async () => {
    db = createTestPrismaClient();
    const suffix = randomBytes(4).toString('hex');
    const workspace = await db.workspace.create({
      data: { name: 'Channels Integration', slug: `channels-it-${suffix}` },
    });
    const user = await db.userProfile.create({
      data: {
        supabaseAuthId: `channels-it-${suffix}`,
        email: `channels-it-${suffix}@vynor.test`,
        displayName: 'Integration Admin',
      },
    });
    const membership = await db.workspaceMembership.create({
      data: { workspaceId: workspace.id, userProfileId: user.id },
    });
    actor = {
      user: {
        id: user.id,
        supabaseAuthId: user.supabaseAuthId,
        email: user.email,
        displayName: user.displayName,
        isActive: true,
      },
      workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug, timezone: 'UTC' },
      membership: { id: membership.id, status: 'ACTIVE', roles: ['SUPER_ADMIN'], teams: [] },
      permissions: ['*'],
      correlationId: 'corr_channels_it',
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    if (!db) return;
    const workspaceId = actor?.workspace.id;
    if (workspaceId) {
      await db.outboxEvent.deleteMany({ where: { workspaceId } });
      await db.providerEvent.deleteMany({ where: { workspaceId } });
      await db.providerAccountMember.deleteMany({ where: { providerAccount: { workspaceId } } });
      await db.providerAccount.deleteMany({ where: { workspaceId } });
      await db.workspaceMembership.deleteMany({ where: { workspaceId } });
      await db.userProfile.deleteMany({ where: { id: actor.user.id } });
      await db.workspace.delete({ where: { id: workspaceId } });
    }
    await db.$disconnect();
  });

  it('connects WhatsApp: verifies with Meta, stores credentials encrypted and registers the webhook', async () => {
    providerCalls = installFakeProviders();

    const channel = await channels.create(
      actor,
      {
        name: 'WhatsApp Toko',
        connection: {
          provider: 'WHATSAPP_CLOUD',
          credentials: {
            accessToken: ACCESS_TOKEN,
            phoneNumberId: PHONE_ID,
            businessAccountId: WABA_ID,
            appSecret: APP_SECRET,
          },
        },
      },
      'corr_connect',
    );

    expect(channel.status).toBe('ACTIVE');
    expect(channel.identifier).toBe('+62 811-0000-1111');
    expect(channel.inbound.mode).toBe('WEBHOOK');
    expect(channel.inbound.webhookUrl).toMatch(
      /^https:\/\/crm\.vynor\.test\/api\/v1\/webhooks\/whatsapp\/[A-Za-z0-9_-]{20,}$/,
    );
    expect(channel.inbound.webhookRegistered).toBe(true);
    expect(channel.inbound.verifyToken).toEqual(expect.any(String));

    // The phone number's callback override points at the channel URL with its verify token.
    const override = providerCalls.find(
      (c) => c.method === 'POST' && c.url.pathname.endsWith(`/${PHONE_ID}`),
    );
    expect(override?.body).toEqual({
      webhook_configuration: {
        override_callback_uri: channel.inbound.webhookUrl,
        verify_token: channel.inbound.verifyToken,
      },
    });

    // Secrets never leave the database in plaintext, nor through the API DTO.
    const row = await db.providerAccount.findUniqueOrThrow({ where: { id: channel.id } });
    const stored = JSON.stringify(row.credentials);
    expect(stored).not.toContain(ACCESS_TOKEN);
    expect(stored).not.toContain(APP_SECRET);
    expect(row.credentials).toMatchObject({ keyId: 'v1', accountId: channel.id });
    expect(JSON.stringify(channel)).not.toContain(ACCESS_TOKEN);
    expect(JSON.stringify(channel)).not.toContain(APP_SECRET);
  });

  it('refuses to connect the same number twice', async () => {
    installFakeProviders();
    await expect(
      channels.create(
        actor,
        {
          name: 'WhatsApp Duplicate',
          connection: {
            provider: 'WHATSAPP_CLOUD',
            credentials: {
              accessToken: ACCESS_TOKEN,
              phoneNumberId: PHONE_ID,
              businessAccountId: WABA_ID,
              appSecret: APP_SECRET,
            },
          },
        },
        'corr_duplicate',
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('keeps the working credentials when an update is rejected by the provider', async () => {
    installFakeProviders();
    const [channel] = await channels.list(actor);
    const before = await db.providerAccount.findUniqueOrThrow({ where: { id: channel!.id } });

    await expect(
      channels.reconnect(
        actor,
        channel!.id,
        {
          connection: {
            provider: 'WHATSAPP_CLOUD',
            credentials: {
              accessToken: 'EAAG-BAD-token-rejected-by-meta-0123456789',
              phoneNumberId: PHONE_ID,
              businessAccountId: WABA_ID,
              appSecret: APP_SECRET,
            },
          },
        },
        'corr_reconnect',
      ),
    ).rejects.toMatchObject({ status: 422 });

    const after = await db.providerAccount.findUniqueOrThrow({ where: { id: channel!.id } });
    expect(after.credentials).toEqual(before.credentials);
    expect(after.status).toBe('ACTIVE');
  });

  it('answers the Meta handshake only with the channel verify token', async () => {
    const [channel] = await channels.list(actor);
    const key = channel!.inbound.webhookUrl!.split('/').pop()!;
    const handshake = (token: string): WebhookRequest => ({
      method: 'GET',
      rawBody: Buffer.alloc(0),
      headers: {},
      query: { 'hub.mode': 'subscribe', 'hub.verify_token': token, 'hub.challenge': '1158201444' },
    });

    await expect(
      webhooks.handle('whatsapp', key, handshake(channel!.inbound.verifyToken!), 'c1'),
    ).resolves.toEqual({ status: 200, body: '1158201444' });
    await expect(
      webhooks.handle('whatsapp', key, handshake('wrong-token'), 'c2'),
    ).resolves.toMatchObject({ status: 403 });
  });

  it('journals signed webhooks once, rejects forged ones and hides unknown keys', async () => {
    const [channel] = await channels.list(actor);
    const key = channel!.inbound.webhookUrl!.split('/').pop()!;
    const delivery = signedWhatsAppDelivery('Halo, apakah produk ini ready stok?', 'wamid.IT-1');

    await expect(webhooks.handle('whatsapp', key, delivery, 'c3')).resolves.toEqual({
      status: 200,
      body: { received: true, accepted: 1, duplicates: 0 },
    });
    // Meta retries the same delivery: nothing new is journaled.
    await expect(webhooks.handle('whatsapp', key, delivery, 'c4')).resolves.toEqual({
      status: 200,
      body: { received: true, accepted: 0, duplicates: 1 },
    });

    const forged = signedWhatsAppDelivery('Forged', 'wamid.IT-FORGED');
    forged.headers['x-hub-signature-256'] = `sha256=${'0'.repeat(64)}`;
    await expect(webhooks.handle('whatsapp', key, forged, 'c5')).resolves.toMatchObject({
      status: 401,
    });
    await expect(
      webhooks.handle('whatsapp', 'not-a-channel-key', delivery, 'c6'),
    ).resolves.toMatchObject({ status: 404 });

    const events = await db.providerEvent.findMany({ where: { providerAccountId: channel!.id } });
    expect(events.map((e) => e.providerEventKey)).toEqual(['msg:wamid.IT-1']);
    expect(JSON.stringify(events[0]!.headers)).not.toContain('x-hub-signature-256');
    const outbox = await db.outboxEvent.findMany({
      where: { workspaceId: actor.workspace.id, eventType: 'webhook.received' },
    });
    expect(outbox).toHaveLength(1);
  });

  it('switches Telegram to polling when there is no public HTTPS address', async () => {
    const calls = installFakeProviders();
    const localRuntime = buildRuntime('http://localhost:3001');
    const telegram = await new ChannelsService(localRuntime, audit).create(
      actor,
      {
        name: 'Telegram Support',
        connection: { provider: 'TELEGRAM_BOT', credentials: { botToken: BOT_TOKEN } },
      },
      'corr_telegram',
    );

    expect(telegram.identifier).toBe('@TokoBot');
    expect(telegram.inbound.mode).toBe('POLLING');
    expect(telegram.inbound.webhookUrl).toBeNull();
    expect(calls.some((c) => c.url.pathname.endsWith('/deleteWebhook'))).toBe(true);
    expect(calls.some((c) => c.url.pathname.endsWith('/setWebhook'))).toBe(false);
  });

  it('disables the webhook URL when a channel is deleted, keeping its history', async () => {
    installFakeProviders();
    const whatsapp = (await channels.list(actor)).find((c) => c.provider === 'WHATSAPP_CLOUD')!;
    const key = whatsapp.inbound.webhookUrl!.split('/').pop()!;

    await channels.remove(actor, whatsapp.id, 'corr_delete');

    const row = await db.providerAccount.findUniqueOrThrow({ where: { id: whatsapp.id } });
    expect(row.deletedAt).not.toBeNull();
    expect(row.webhookKey).toBeNull();
    await expect(
      webhooks.handle('whatsapp', key, signedWhatsAppDelivery('Halo lagi', 'wamid.IT-2'), 'c7'),
    ).resolves.toMatchObject({ status: 404 });
    await expect(
      db.providerEvent.count({ where: { providerAccountId: whatsapp.id } }),
    ).resolves.toBe(1);
  });
});
