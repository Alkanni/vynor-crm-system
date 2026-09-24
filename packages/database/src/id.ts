import { createId, isCuid } from '@paralleldrive/cuid2';
import { uuidv7 } from 'uuidv7';

/**
 * Standard UUID regex matching v1-v7 UUIDs.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Generates a collision-resistant, URL-safe, entropy-dense CUID2 identifier.
 * Optionally prefixes the identifier (e.g. `ws_...`, `usr_...`).
 *
 * @param prefix Optional entity prefix.
 * @returns Generated CUID2 string.
 */
export function generateId(prefix?: string): string {
  const id = createId();
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Generates a time-sortable, RFC 9562 compliant UUIDv7 identifier.
 * Ideal for high-throughput sequential inserts such as outbox events,
 * logs, audit records, and chat messages to maintain B-tree index locality.
 *
 * @returns Generated UUIDv7 string.
 */
export function generateUuidV7(): string {
  return uuidv7();
}

/**
 * Validates whether a given string is a valid CUID2 identifier.
 *
 * @param id The string identifier to validate.
 * @param prefix Optional expected prefix to strip before checking.
 */
export function isValidCuid2(id: string, prefix?: string): boolean {
  if (prefix) {
    if (!id.startsWith(`${prefix}_`)) {
      return false;
    }
    const rawId = id.slice(prefix.length + 1);
    return isCuid(rawId);
  }
  return isCuid(id);
}

/**
 * Validates whether a given string is a valid UUID (including UUIDv7).
 *
 * @param id The string identifier to validate.
 */
export function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}
