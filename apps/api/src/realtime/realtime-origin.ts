import type { IncomingMessage } from 'node:http';
import { getApiEnv, parseCorsAllowedOrigins } from '../config/api-env.js';

/**
 * Whether a realtime handshake from this Origin may proceed. Browsers send Origin on every
 * WebSocket and cross-origin polling request, so a page on a foreign site is refused (cross-site
 * WebSocket hijacking; CORS headers alone do not protect WebSocket). Requests without Origin come
 * from non-browser clients and still have to pass the JWT handshake.
 */
export function isAllowedRealtimeOrigin(
  origin: string | undefined,
  allowedOrigins: readonly string[],
): boolean {
  return origin === undefined || allowedOrigins.includes(origin);
}

/** CORS_ALLOWED_ORIGINS, read when a client connects (main.ts loads .env before listening). */
function allowedOrigins(): string[] {
  return parseCorsAllowedOrigins(getApiEnv().CORS_ALLOWED_ORIGINS);
}

/** Socket.IO `cors.origin`: answer polling requests with CORS headers for allowed origins only. */
export function realtimeCorsOrigin(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  callback(null, isAllowedRealtimeOrigin(origin, allowedOrigins()));
}

/** Socket.IO `allowRequest`: refuse the handshake (polling and WebSocket) from other origins. */
export function allowRealtimeRequest(
  request: IncomingMessage,
  callback: (err: string | null | undefined, success: boolean) => void,
): void {
  const allowed = isAllowedRealtimeOrigin(request.headers.origin, allowedOrigins());
  callback(allowed ? null : 'Origin not allowed', allowed);
}
