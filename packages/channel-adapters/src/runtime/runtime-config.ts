/**
 * Provider endpoints and HTTP settings shared by all adapters. Base URLs only differ from the
 * defaults in tests, where they point at a local mock provider.
 */
export interface AdapterRuntimeConfig {
  metaGraphApiVersion: string;
  metaGraphApiBaseUrl: string;
  instagramGraphApiBaseUrl: string;
  telegramApiBaseUrl: string;
  lineApiBaseUrl: string;
  lineDataApiBaseUrl: string;
  httpTimeoutMs: number;
  /** Injectable for tests; defaults to the global fetch. */
  fetch?: typeof fetch;
}

export const DEFAULT_ADAPTER_RUNTIME: AdapterRuntimeConfig = {
  metaGraphApiVersion: 'v26.0',
  metaGraphApiBaseUrl: 'https://graph.facebook.com',
  instagramGraphApiBaseUrl: 'https://graph.instagram.com',
  telegramApiBaseUrl: 'https://api.telegram.org',
  lineApiBaseUrl: 'https://api.line.me',
  lineDataApiBaseUrl: 'https://api-data.line.me',
  httpTimeoutMs: 15_000,
};

export interface AdapterRuntimeEnv {
  META_GRAPH_API_VERSION?: string | undefined;
  META_GRAPH_API_BASE_URL?: string | undefined;
  INSTAGRAM_GRAPH_API_BASE_URL?: string | undefined;
  TELEGRAM_API_BASE_URL?: string | undefined;
  LINE_API_BASE_URL?: string | undefined;
  LINE_DATA_API_BASE_URL?: string | undefined;
  CHANNEL_HTTP_TIMEOUT_MS?: number | string | undefined;
}

/** Builds the runtime config from validated env (`ChannelRuntimeEnvSchema`). */
export function adapterRuntimeFromEnv(env: AdapterRuntimeEnv): AdapterRuntimeConfig {
  const trim = (url: string) => url.replace(/\/+$/, '');
  return {
    metaGraphApiVersion: env.META_GRAPH_API_VERSION ?? DEFAULT_ADAPTER_RUNTIME.metaGraphApiVersion,
    metaGraphApiBaseUrl: trim(
      env.META_GRAPH_API_BASE_URL ?? DEFAULT_ADAPTER_RUNTIME.metaGraphApiBaseUrl,
    ),
    instagramGraphApiBaseUrl: trim(
      env.INSTAGRAM_GRAPH_API_BASE_URL ?? DEFAULT_ADAPTER_RUNTIME.instagramGraphApiBaseUrl,
    ),
    telegramApiBaseUrl: trim(
      env.TELEGRAM_API_BASE_URL ?? DEFAULT_ADAPTER_RUNTIME.telegramApiBaseUrl,
    ),
    lineApiBaseUrl: trim(env.LINE_API_BASE_URL ?? DEFAULT_ADAPTER_RUNTIME.lineApiBaseUrl),
    lineDataApiBaseUrl: trim(
      env.LINE_DATA_API_BASE_URL ?? DEFAULT_ADAPTER_RUNTIME.lineDataApiBaseUrl,
    ),
    httpTimeoutMs:
      env.CHANNEL_HTTP_TIMEOUT_MS !== undefined
        ? Number(env.CHANNEL_HTTP_TIMEOUT_MS)
        : DEFAULT_ADAPTER_RUNTIME.httpTimeoutMs,
  };
}
