import type { ChannelInboundMode } from '@vynor/contracts';
import type { AdapterAccount, GeneratedChannelSecrets } from '../src/index.js';
import { DEFAULT_ADAPTER_RUNTIME, type AdapterRuntimeConfig } from '../src/index.js';

export interface RecordedCall {
  url: URL;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
  json: unknown;
}

export interface MockResponse {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  /** Raw bytes for binary downloads. */
  bytes?: Buffer;
}

/** Fetch stub that records requests and replays queued responses in order. */
export function createMockFetch(responses: MockResponse[]) {
  const calls: RecordedCall[] = [];
  const queue = [...responses];
  const fetchImpl = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const body = typeof init?.body === 'string' ? init.body : undefined;
    let json: unknown;
    try {
      json = body ? JSON.parse(body) : undefined;
    } catch {
      json = undefined;
    }
    calls.push({ url, method: init?.method ?? 'GET', headers, body, json });

    const next = queue.shift() ?? { status: 200, body: {} };
    const status = next.status ?? 200;
    if (next.bytes) {
      return new Response(next.bytes, {
        status,
        headers: { 'content-type': 'application/octet-stream', ...next.headers },
      });
    }
    return new Response(next.body === undefined ? '' : JSON.stringify(next.body), {
      status,
      headers: { 'content-type': 'application/json', ...next.headers },
    });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

export function runtimeWith(fetchImpl: typeof fetch): AdapterRuntimeConfig {
  return { ...DEFAULT_ADAPTER_RUNTIME, fetch: fetchImpl, httpTimeoutMs: 2000 };
}

export function accountFor<T>(
  credentials: T,
  overrides: Partial<Omit<AdapterAccount<T>, 'credentials'>> & {
    secrets?: GeneratedChannelSecrets;
  } = {},
): AdapterAccount<T> {
  return {
    id: 'ch_test',
    workspaceId: 'ws_test',
    name: 'Test inbox',
    accountIdentifier: 'acct_1',
    displayIdentifier: 'Test Account',
    secrets: {},
    inboundMode: 'WEBHOOK' as ChannelInboundMode,
    ...overrides,
    credentials,
  };
}

export const normalizeContext = {
  workspaceId: 'ws_test',
  providerAccountId: 'ch_test',
  providerEventId: 'pe_1',
  providerEventKey: 'key_1',
};
