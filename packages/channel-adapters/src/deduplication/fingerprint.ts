import { createHash } from 'node:crypto';

export const FINGERPRINT_PREFIX = 'fp_sha256:';

/**
 * Recursively canonicalizes an arbitrary data structure to produce a deterministic string representation.
 * Keys in JSON objects are sorted alphabetically, arrays preserve order, and primitive values are normalized (FND-068).
 */
export function canonicalizePayload(data: unknown): string {
  if (data === null || data === undefined) {
    return 'null';
  }

  if (typeof data !== 'object') {
    return JSON.stringify(data);
  }

  if (Array.isArray(data)) {
    const elements = data.map((item) => canonicalizePayload(item));
    return `[${elements.join(',')}]`;
  }

  // Record / Object: sort keys alphabetically
  const record = data as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const entries: string[] = [];

  for (const key of sortedKeys) {
    const value = record[key];
    // Skip undefined fields to maintain parity with JSON.stringify semantics
    if (value !== undefined) {
      entries.push(`${JSON.stringify(key)}:${canonicalizePayload(value)}`);
    }
  }

  return `{${entries.join(',')}}`;
}

/**
 * Generates a deterministic SHA-256 deduplication fingerprint when a provider does not supply
 * a native top-level event ID (FND-068, AD-005).
 *
 * Prefix format: `fp_sha256:<64-char-hex-hash>`
 */
export function generateEventFingerprint(
  providerAccountId: string,
  payload: unknown,
  options?: { prefix?: string },
): string {
  const prefix = options?.prefix ?? FINGERPRINT_PREFIX;
  const canonicalContent = canonicalizePayload(payload);

  const hash = createHash('sha256')
    .update(`${providerAccountId}:${canonicalContent}`)
    .digest('hex');

  return `${prefix}${hash}`;
}

/**
 * Checks whether a given provider event key is a generated fallback fingerprint.
 */
export function isEventFingerprint(eventKey: string): boolean {
  return eventKey.startsWith(FINGERPRINT_PREFIX);
}
