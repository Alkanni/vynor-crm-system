/**
 * Helpers the E2E specs share: the provider stub's control API, the real VYNOR API (as a
 * signed-in user) and read access to the E2E database and Redis for journal/outbox/queue
 * assertions.
 */
import { expect, type Page, type TestInfo } from '@playwright/test';
import { createDatabaseClient, type PrismaClient } from '@vynor/database';
import { Redis } from 'ioredis';
import { assertSafeE2eDatabaseUrl, assertSafeE2eRedisUrl } from './database-guard';
import { API_BASE, STUB_ORIGIN, STUB_WABA_ID, WEB_ORIGIN } from './e2e-env';
import type { ProviderCall, SendOutcome, WebhookDelivery } from './graph-stub';

async function json<T>(response: Response, label: string): Promise<T> {
  const text = await response.text();
  if (!response.ok) throw new Error(`${label} failed with HTTP ${response.status}: ${text}`);
  return (text ? JSON.parse(text) : {}) as T;
}

// ---------------------------------------------------------------------------
// Provider stub
// ---------------------------------------------------------------------------

async function stubPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${STUB_ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return json<T>(response, `stub ${path}`);
}

export const stub = {
  /** Where the stub posts this phone number's webhooks, and the secret it signs them with. */
  registerChannel: (phoneNumberId: string, callbackUrl: string, appSecret: string) =>
    stubPost('/__stub/channels', { phoneNumberId, callbackUrl, appSecret }),
  /** Outcomes for the next sends to `to`, in order; afterwards sends succeed again. */
  queueOutcomes: (to: string, outcomes: SendOutcome[]) =>
    stubPost('/__stub/outcomes', { to, outcomes }),
  inbound: (message: {
    phoneNumberId: string;
    from: string;
    name: string;
    text: string;
    wamid: string;
  }) => stubPost<WebhookDelivery>('/__stub/webhooks/inbound', message),
  receipt: (wamid: string, status: 'sent' | 'delivered' | 'read') =>
    stubPost<WebhookDelivery>('/__stub/webhooks/status', { wamid, status }),
  replay: (deliveryId: number) =>
    stubPost<WebhookDelivery>(`/__stub/deliveries/${deliveryId}/replay`, {}),
  calls: async () =>
    (await json<{ calls: ProviderCall[] }>(await fetch(`${STUB_ORIGIN}/__stub/calls`), 'calls'))
      .calls,
  deliveries: async () =>
    (
      await json<{ deliveries: WebhookDelivery[] }>(
        await fetch(`${STUB_ORIGIN}/__stub/deliveries`),
        'deliveries',
      )
    ).deliveries,
};

/** Attaches the stub's provider call log and webhook deliveries to the test report. */
export async function attachProviderTrace(testInfo: TestInfo): Promise<void> {
  const trace = { calls: await stub.calls(), deliveries: await stub.deliveries() };
  await testInfo.attach('provider-stub-trace.json', {
    body: JSON.stringify(trace, null, 2),
    contentType: 'application/json',
  });
}

// ---------------------------------------------------------------------------
// VYNOR API
// ---------------------------------------------------------------------------

export interface ApiResult<T> {
  status: number;
  body: T;
}

export async function devSessionToken(email: string): Promise<string> {
  const response = await fetch(`${API_BASE}/auth/dev-session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const body = await json<{ data: { accessToken: string } }>(response, `dev-session ${email}`);
  return body.data.accessToken;
}

export async function callApi<T = unknown>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<ApiResult<T>> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
}

export interface ConnectedChannel {
  id: string;
  name: string;
  phoneNumberId: string;
  appSecret: string;
  webhookUrl: string;
}

/**
 * Connects a WhatsApp Cloud channel through the API (the API verifies it against the stub) and
 * tells the stub where to deliver that number's webhooks.
 */
export async function connectWhatsAppChannel(
  token: string,
  options: { name: string; phoneNumberId: string; appSecret: string },
): Promise<ConnectedChannel> {
  const created = await callApi<{
    data: { id: string; name: string; inbound: { webhookUrl: string | null } };
  }>(token, 'POST', '/channels', {
    name: options.name,
    connection: {
      provider: 'WHATSAPP_CLOUD',
      credentials: {
        accessToken: `EAAGe2eStubAccessToken${options.phoneNumberId}`,
        phoneNumberId: options.phoneNumberId,
        businessAccountId: STUB_WABA_ID,
        appSecret: options.appSecret,
      },
    },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const webhookUrl = created.body.data.inbound.webhookUrl;
  if (!webhookUrl) throw new Error('The WhatsApp channel has no webhook URL.');
  await stub.registerChannel(options.phoneNumberId, webhookUrl, options.appSecret);
  return {
    id: created.body.data.id,
    name: created.body.data.name,
    phoneNumberId: options.phoneNumberId,
    appSecret: options.appSecret,
    webhookUrl,
  };
}

// ---------------------------------------------------------------------------
// Web app
// ---------------------------------------------------------------------------

/** Signs in through the login page's local dev-session button, like a developer would. */
export async function signInWithDevSession(page: Page, returnUrl = '/inbox'): Promise<void> {
  await page.goto(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
  await page.getByRole('button', { name: 'Sign in as local admin (development)' }).click();
  await expect(page).toHaveURL(returnUrl);
}

/**
 * Signs in as any seeded user without the login page: stores the dev session where the web app
 * keeps it and sets the cookie the edge middleware checks (the login page only offers the admin).
 */
export async function signInAs(page: Page, email: string): Promise<void> {
  const response = await fetch(`${API_BASE}/auth/dev-session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const session = (await json<{ data: { accessToken: string } }>(response, `dev-session ${email}`))
    .data;
  await page
    .context()
    .addCookies([{ name: 'vynor_session', value: session.accessToken, url: WEB_ORIGIN }]);
  await page.addInitScript((value) => {
    window.localStorage.setItem('vynor_dev_session', value);
  }, JSON.stringify(session));
}

// ---------------------------------------------------------------------------
// E2E database (read-mostly assertions)
// ---------------------------------------------------------------------------

let db: PrismaClient | null = null;

export function e2eDatabase(): PrismaClient {
  if (!db) {
    const url = process.env.E2E_DATABASE_URL;
    assertSafeE2eDatabaseUrl(url);
    db = createDatabaseClient({ databaseUrl: url!, logging: false });
  }
  return db;
}

let redis: Redis | null = null;

/** The E2E Redis, where the worker keeps its BullMQ queues (WU-05a). Read-only use. */
function e2eRedis(): Redis {
  redis ??= new Redis(assertSafeE2eRedisUrl(process.env.E2E_REDIS_URL));
  return redis;
}

/**
 * Whether the worker's BullMQ queue finished a job: BullMQ keeps finished jobs in the queue's
 * `completed` sorted set (key prefix BULLMQ_PREFIX of apps/worker).
 */
export async function bullmqJobCompleted(queue: string, jobId: string): Promise<boolean> {
  return (await e2eRedis().zscore(`vynor:bull:${queue}:completed`, jobId)) !== null;
}

export async function closeE2eDatabase(): Promise<void> {
  await db?.$disconnect();
  db = null;
  await redis?.quit();
  redis = null;
}
