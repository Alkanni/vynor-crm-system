import type { ChannelProviderType } from '@vynor/contracts';

/**
 * Why a provider call failed, independent of the provider's own error codes.
 * Drives retries (RATE_LIMITED, TRANSIENT), reconnect prompts (AUTHENTICATION, PERMISSION)
 * and the message shown to agents.
 */
export const PROVIDER_ERROR_CATEGORIES = [
  'AUTHENTICATION',
  'PERMISSION',
  'RATE_LIMITED',
  'INVALID_REQUEST',
  'RECIPIENT_UNAVAILABLE',
  'REPLY_WINDOW_CLOSED',
  'NOT_FOUND',
  'CONFIGURATION',
  'TRANSIENT',
] as const;
export type ProviderErrorCategory = (typeof PROVIDER_ERROR_CATEGORIES)[number];

export interface ChannelProviderErrorInit {
  provider: ChannelProviderType;
  category: ProviderErrorCategory;
  /** Provider error code (e.g. Graph `131047`, SMTP `EAUTH`) or a VYNOR code. */
  code: string;
  /** Safe, human-readable explanation. Never includes tokens or request URLs. */
  message: string;
  httpStatus?: number;
  retryAfterSeconds?: number;
  details?: Record<string, unknown>;
  cause?: unknown;
}

export class ChannelProviderError extends Error {
  readonly provider: ChannelProviderType;
  readonly category: ProviderErrorCategory;
  readonly code: string;
  readonly httpStatus: number | undefined;
  readonly retryAfterSeconds: number | undefined;
  readonly details: Record<string, unknown> | undefined;

  constructor(init: ChannelProviderErrorInit) {
    super(init.message, init.cause === undefined ? undefined : { cause: init.cause });
    this.name = 'ChannelProviderError';
    this.provider = init.provider;
    this.category = init.category;
    this.code = init.code;
    this.httpStatus = init.httpStatus;
    this.retryAfterSeconds = init.retryAfterSeconds;
    this.details = init.details;
  }

  /** Worth retrying later with backoff. */
  get retryable(): boolean {
    return this.category === 'RATE_LIMITED' || this.category === 'TRANSIENT';
  }

  /** The stored credentials no longer work; an admin has to reconnect the channel. */
  get requiresReconnect(): boolean {
    return this.category === 'AUTHENTICATION' || this.category === 'PERMISSION';
  }
}

export function isChannelProviderError(error: unknown): error is ChannelProviderError {
  return error instanceof ChannelProviderError;
}

/** Wraps unknown failures (bugs, library errors) so callers always get a categorised error. */
export function toChannelProviderError(
  provider: ChannelProviderType,
  error: unknown,
  fallback: Partial<ChannelProviderErrorInit> = {},
): ChannelProviderError {
  if (isChannelProviderError(error)) return error;
  return new ChannelProviderError({
    provider,
    category: fallback.category ?? 'TRANSIENT',
    code: fallback.code ?? 'PROVIDER_CALL_FAILED',
    message:
      fallback.message ??
      (error instanceof Error ? error.message : 'The provider call failed unexpectedly.'),
    cause: error,
  });
}
