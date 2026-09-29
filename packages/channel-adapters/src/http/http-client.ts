import type { ChannelProviderType } from '@vynor/contracts';
import { ChannelProviderError } from '../errors/provider-error.js';
import type { AdapterRuntimeConfig } from '../runtime/runtime-config.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface HttpRequest {
  method?: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
  /** Serialised as JSON with `Content-Type: application/json`. */
  json?: unknown;
  /** Raw body (sent as-is; set Content-Type yourself). */
  body?: string;
  timeoutMs?: number;
  /** Default true. Custom endpoints disable it so a redirect cannot reach internal hosts. */
  followRedirects?: boolean;
}

export interface HttpResponse<T> {
  status: number;
  headers: Headers;
  data: T;
}

export interface BinaryResponse {
  status: number;
  headers: Headers;
  data: Buffer;
  contentType: string;
}

/** Turns a non-2xx response into a categorised provider error. */
export type ProviderErrorMapper = (response: {
  status: number;
  data: unknown;
  headers: Headers;
}) => ChannelProviderError;

/** Hard cap for media downloads proxied through the API (WhatsApp allows up to 100 MB). */
export const MAX_MEDIA_DOWNLOAD_BYTES = 100 * 1024 * 1024;

/**
 * Minimal fetch wrapper for provider REST APIs: timeouts, JSON handling and error mapping.
 * Error messages never contain the request URL, because some providers (Telegram) put the
 * token in the path.
 */
export class ProviderHttpClient {
  constructor(
    private readonly provider: ChannelProviderType,
    private readonly runtime: AdapterRuntimeConfig,
    private readonly mapError: ProviderErrorMapper,
  ) {}

  async request<T>(request: HttpRequest): Promise<HttpResponse<T>> {
    const response = await this.send(request);
    const data = await parseBody(response);
    if (!response.ok) {
      throw this.mapError({ status: response.status, data, headers: response.headers });
    }
    return { status: response.status, headers: response.headers, data: data as T };
  }

  async requestBinary(request: HttpRequest): Promise<BinaryResponse> {
    const response = await this.send(request);
    if (!response.ok) {
      const data = await parseBody(response);
      throw this.mapError({ status: response.status, data, headers: response.headers });
    }
    const declared = Number(response.headers.get('content-length') ?? '0');
    if (declared > MAX_MEDIA_DOWNLOAD_BYTES) {
      throw new ChannelProviderError({
        provider: this.provider,
        category: 'INVALID_REQUEST',
        code: 'MEDIA_TOO_LARGE',
        message: 'The file is larger than the 100 MB download limit.',
      });
    }
    const data = Buffer.from(await response.arrayBuffer());
    return {
      status: response.status,
      headers: response.headers,
      data,
      contentType: response.headers.get('content-type') ?? 'application/octet-stream',
    };
  }

  private async send(request: HttpRequest): Promise<Response> {
    const url = new URL(request.url);
    for (const [key, value] of Object.entries(request.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = { Accept: 'application/json', ...request.headers };
    let body: string | undefined = request.body;
    if (request.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(request.json);
    }

    const fetchImpl = this.runtime.fetch ?? fetch;
    try {
      return await fetchImpl(url, {
        method: request.method ?? 'GET',
        headers,
        ...(body !== undefined ? { body } : {}),
        signal: AbortSignal.timeout(request.timeoutMs ?? this.runtime.httpTimeoutMs),
        redirect: request.followRedirects === false ? 'manual' : 'follow',
      });
    } catch (error) {
      const timedOut =
        error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      throw new ChannelProviderError({
        provider: this.provider,
        category: 'TRANSIENT',
        code: timedOut ? 'PROVIDER_TIMEOUT' : 'PROVIDER_UNREACHABLE',
        message: timedOut
          ? `The ${providerLabel(this.provider)} API did not respond in time.`
          : `Could not reach the ${providerLabel(this.provider)} API.`,
        cause: error,
      });
    }
  }
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('json') || /^[[{]/.test(text.trim())) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
  return text;
}

/** Parses `Retry-After` (seconds or HTTP date). */
export function parseRetryAfter(headers: Headers): number | undefined {
  const raw = headers.get('retry-after');
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(1, Math.round(seconds));
  const date = Date.parse(raw);
  if (Number.isNaN(date)) return undefined;
  return Math.max(1, Math.round((date - Date.now()) / 1000));
}

export function providerLabel(provider: ChannelProviderType): string {
  switch (provider) {
    case 'WHATSAPP_CLOUD':
      return 'WhatsApp Cloud';
    case 'META_MESSENGER':
      return 'Messenger';
    case 'META_INSTAGRAM':
      return 'Instagram';
    case 'TELEGRAM_BOT':
      return 'Telegram Bot';
    case 'EMAIL_SMTP_IMAP':
      return 'email server';
    case 'LINE_MESSAGING':
      return 'LINE Messaging';
    case 'WEBCHAT_EMBED':
      return 'web chat';
    case 'CUSTOM_WEBHOOK':
      return 'custom';
  }
}

/** Generic mapping by HTTP status when a provider returns no structured error. */
export function mapHttpStatus(
  provider: ChannelProviderType,
  status: number,
  headers: Headers,
  message: string,
  code = `HTTP_${status}`,
): ChannelProviderError {
  const retryAfterSeconds = parseRetryAfter(headers);
  const category =
    status === 401
      ? 'AUTHENTICATION'
      : status === 403
        ? 'PERMISSION'
        : status === 404
          ? 'NOT_FOUND'
          : status === 429
            ? 'RATE_LIMITED'
            : status >= 500
              ? 'TRANSIENT'
              : 'INVALID_REQUEST';
  return new ChannelProviderError({
    provider,
    category,
    code,
    message,
    httpStatus: status,
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
  });
}
