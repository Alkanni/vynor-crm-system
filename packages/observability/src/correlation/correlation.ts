import { randomBytes } from 'node:crypto';

export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const CAUSATION_ID_HEADER = 'x-causation-id';
export const WORKSPACE_ID_HEADER = 'x-workspace-id';

const CORRELATION_ID_REGEX = /^[a-zA-Z0-9_-]{8,128}$/;

/**
 * Generate a cryptographically strong, unique correlation identifier.
 * Example: 'req_1727161200_a8f92b7c4d'
 */
export function generateCorrelationId(prefix = 'req'): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const randomSuffix = randomBytes(6).toString('hex');
  return `${prefix}_${timestamp}_${randomSuffix}`;
}

/**
 * Validate that an incoming correlation ID conforms to security constraints.
 */
export function isValidCorrelationId(val: unknown): val is string {
  return typeof val === 'string' && CORRELATION_ID_REGEX.test(val);
}

/**
 * Resolve correlation ID from request headers or generate a fallback.
 */
export function resolveCorrelationId(
  headers: Record<string, string | string[] | undefined>,
  prefix = 'req',
): string {
  const candidate = headers[CORRELATION_ID_HEADER];
  const value = Array.isArray(candidate) ? candidate[0] : candidate;

  if (value && isValidCorrelationId(value)) {
    return value;
  }

  return generateCorrelationId(prefix);
}
