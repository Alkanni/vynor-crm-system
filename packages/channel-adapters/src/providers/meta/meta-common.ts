import type { ChannelProviderType } from '@vynor/contracts';
import { ChannelProviderError, type ProviderErrorCategory } from '../../errors/provider-error.js';
import { mapHttpStatus, parseRetryAfter, providerLabel } from '../../http/http-client.js';
import type {
  WebhookRequest,
  WebhookValidationResult,
} from '../../interfaces/channel-adapter.interface.js';
import { hmacSha256Hex, readHeader, safeEqual } from '../../signatures/hmac.js';

/**
 * Pieces shared by the Meta platform adapters (WhatsApp Cloud API, Messenger, Instagram).
 */

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Answers the webhook subscription handshake (`hub.mode=subscribe`). */
export function answerMetaVerificationChallenge(
  request: WebhookRequest,
  verifyToken: string | undefined,
): WebhookValidationResult {
  const mode = firstQueryValue(request.query['hub.mode']);
  const token = firstQueryValue(request.query['hub.verify_token']);
  const challenge = firstQueryValue(request.query['hub.challenge']);

  if (mode !== 'subscribe' || !challenge) {
    return { isValid: false, statusCode: 400, failureReason: 'Not a verification request.' };
  }
  if (!verifyToken || !token || !safeEqual(token, verifyToken)) {
    return { isValid: false, statusCode: 403, failureReason: 'Verify token does not match.' };
  }
  return { isValid: true, statusCode: 200, challengeResponse: challenge };
}

/** Verifies `X-Hub-Signature-256: sha256=<hex HMAC of the raw body>`. */
export function verifyMetaSignature(
  request: WebhookRequest,
  appSecret: string,
): WebhookValidationResult {
  const header = readHeader(request.headers, 'x-hub-signature-256');
  if (!header?.startsWith('sha256=')) {
    return { isValid: false, statusCode: 401, failureReason: 'Missing webhook signature.' };
  }
  const expected = hmacSha256Hex(appSecret, request.rawBody);
  if (!safeEqual(header.slice('sha256='.length), expected)) {
    return { isValid: false, statusCode: 401, failureReason: 'Invalid webhook signature.' };
  }
  return { isValid: true, statusCode: 200 };
}

/** GET = handshake, POST = signed event delivery. */
export function validateMetaWebhook(
  request: WebhookRequest,
  secrets: { appSecret: string; verifyToken: string | undefined },
): WebhookValidationResult {
  return request.method === 'GET'
    ? answerMetaVerificationChallenge(request, secrets.verifyToken)
    : verifyMetaSignature(request, secrets.appSecret);
}

interface GraphErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    error_user_title?: string;
    error_user_msg?: string;
    error_data?: { details?: string } | string;
    fbtrace_id?: string;
  };
}

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80007, 130429, 131048, 131056]);
const TRANSIENT_CODES = new Set([1, 2, 131000, 131016, 133004]);
const RECIPIENT_CODES = new Set([131026, 131021, 551, 2018001, 131045]);

/** Categorises a Graph API error code (https://developers.facebook.com/docs/graph-api/guides/error-handling). */
export function categorizeGraphError(
  code: number | undefined,
  subcode: number | undefined,
  status: number,
): ProviderErrorCategory {
  if (code === undefined) {
    if (status === 401) return 'AUTHENTICATION';
    if (status === 429) return 'RATE_LIMITED';
    if (status >= 500) return 'TRANSIENT';
    return 'INVALID_REQUEST';
  }
  if (code === 190 || code === 102 || code === 463 || code === 467) return 'AUTHENTICATION';
  if (RATE_LIMIT_CODES.has(code)) return 'RATE_LIMITED';
  if (code === 131047 || subcode === 2018278 || subcode === 2534022) return 'REPLY_WINDOW_CLOSED';
  if (RECIPIENT_CODES.has(code)) return 'RECIPIENT_UNAVAILABLE';
  if (TRANSIENT_CODES.has(code)) return 'TRANSIENT';
  if (code === 133010 || code === 131030) return 'CONFIGURATION';
  if (code === 10 || code === 3 || code === 368 || (code >= 200 && code <= 299)) {
    return 'PERMISSION';
  }
  if (code === 803 || code === 100) return subcode === 33 ? 'NOT_FOUND' : 'INVALID_REQUEST';
  if (status >= 500) return 'TRANSIENT';
  return 'INVALID_REQUEST';
}

/** Maps a failed Graph API response to a `ChannelProviderError`. */
export function mapGraphError(provider: ChannelProviderType) {
  return ({ status, data, headers }: { status: number; data: unknown; headers: Headers }) => {
    const body = (data && typeof data === 'object' ? data : {}) as GraphErrorBody;
    const error = body.error;
    if (!error) {
      return mapHttpStatus(
        provider,
        status,
        headers,
        `The ${providerLabel(provider)} API returned HTTP ${status}.`,
      );
    }
    const details =
      typeof error.error_data === 'string' ? error.error_data : error.error_data?.details;
    const readable =
      error.error_user_msg ?? [error.message, details].filter(Boolean).join(' — ') ?? '';
    const retryAfterSeconds = parseRetryAfter(headers);
    return new ChannelProviderError({
      provider,
      category: categorizeGraphError(error.code, error.error_subcode, status),
      code: String(error.code ?? `HTTP_${status}`),
      message: readable || `The ${providerLabel(provider)} API returned HTTP ${status}.`,
      httpStatus: status,
      ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
      details: {
        ...(error.error_subcode !== undefined ? { subcode: error.error_subcode } : {}),
        ...(error.type ? { type: error.type } : {}),
        ...(error.fbtrace_id ? { fbtraceId: error.fbtrace_id } : {}),
      },
    });
  };
}
