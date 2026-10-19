import { createHash, randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import { REDIS_KEY_PREFIX } from './redis-client.js';

/** A response kept so a repeated request gets the same answer. */
export interface StoredResponse {
  statusCode: number;
  body: unknown;
}

export type IdempotencyRecord =
  | { status: 'IN_FLIGHT'; fingerprint: string }
  | { status: 'COMPLETED'; fingerprint: string; response: StoredResponse };

/**
 * Outcome of a claim: either this request now owns the key (and only the holder of `lease`
 * may complete or release it), or the key already holds a record.
 */
export type IdempotencyClaim =
  { claimed: true; lease: string } | { claimed: false; record: IdempotencyRecord };

/**
 * Idempotency-Key records (FND-040). Every method may reject when the store is unreachable;
 * the interceptor then fails closed.
 */
export abstract class IdempotencyStore {
  /** Atomically takes the key as IN_FLIGHT for `ttlMs`, or returns the record already there. */
  abstract claim(key: string, fingerprint: string, ttlMs: number): Promise<IdempotencyClaim>;

  /** Stores the response for replay, if `lease` still owns the key; false when it does not. */
  abstract complete(
    key: string,
    lease: string,
    fingerprint: string,
    response: StoredResponse,
    ttlMs: number,
  ): Promise<boolean>;

  /** Frees the key after a failed request, if `lease` still owns it, so a retry runs again. */
  abstract release(key: string, lease: string): Promise<void>;
}

/**
 * Store key for an Idempotency-Key: scoped to the workspace, method and path (unchanged from
 * the in-memory store, so not to the user; NF-12). The method, path and client key are hashed,
 * so no identifier from the URL ends up in Redis.
 */
export function idempotencyRecordKey(
  workspaceId: string,
  method: string,
  path: string,
  idempotencyKey: string,
): string {
  const scope = createHash('sha256').update(`${method} ${path} ${idempotencyKey}`).digest('hex');
  return `${REDIS_KEY_PREFIX}idem:${workspaceId}:${scope}`;
}

interface StoredInFlight {
  status: 'IN_FLIGHT';
  fingerprint: string;
  lease: string;
}

function inFlightValue(fingerprint: string): string {
  const value: StoredInFlight = { status: 'IN_FLIGHT', fingerprint, lease: randomUUID() };
  return JSON.stringify(value);
}

function toRecord(value: StoredInFlight | IdempotencyRecord): IdempotencyRecord {
  return value.status === 'IN_FLIGHT'
    ? { status: 'IN_FLIGHT', fingerprint: value.fingerprint }
    : value;
}

// Each script runs atomically in Redis. The lease is the exact IN_FLIGHT value its claim
// wrote, so complete and release can never touch a record another request claimed after the
// in-flight TTL ran out.
const CLAIM_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if current then return current end
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])
return false`;

const COMPLETE_SCRIPT = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
return 1`;

const RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('DEL', KEYS[1]) end
return 1`;

/** Records shared by every API instance (WU-04, DEC-04). */
export class RedisIdempotencyStore extends IdempotencyStore {
  constructor(private readonly redis: Redis) {
    super();
  }

  async claim(key: string, fingerprint: string, ttlMs: number): Promise<IdempotencyClaim> {
    const lease = inFlightValue(fingerprint);
    const current = (await this.redis.eval(CLAIM_SCRIPT, 1, key, lease, ttlMs)) as string | null;
    if (current === null) return { claimed: true, lease };
    return { claimed: false, record: toRecord(JSON.parse(current) as StoredInFlight) };
  }

  async complete(
    key: string,
    lease: string,
    fingerprint: string,
    response: StoredResponse,
    ttlMs: number,
  ): Promise<boolean> {
    const record: IdempotencyRecord = { status: 'COMPLETED', fingerprint, response };
    const stored = await this.redis.eval(
      COMPLETE_SCRIPT,
      1,
      key,
      lease,
      JSON.stringify(record),
      ttlMs,
    );
    return stored === 1;
  }

  async release(key: string, lease: string): Promise<void> {
    await this.redis.eval(RELEASE_SCRIPT, 1, key, lease);
  }
}

/**
 * Per-process records, for a single local or test process only (SHARED_STATE_STORE=memory):
 * another instance never sees them.
 */
export class MemoryIdempotencyStore extends IdempotencyStore {
  private readonly records = new Map<
    string,
    { value: StoredInFlight | IdempotencyRecord; lease?: string; expiresAt: number }
  >();

  private current(key: string) {
    const entry = this.records.get(key);
    if (entry && Date.now() > entry.expiresAt) {
      this.records.delete(key);
      return undefined;
    }
    return entry;
  }

  async claim(key: string, fingerprint: string, ttlMs: number): Promise<IdempotencyClaim> {
    const existing = this.current(key);
    if (existing) return { claimed: false, record: toRecord(existing.value) };
    const lease = inFlightValue(fingerprint);
    this.records.set(key, {
      value: JSON.parse(lease) as StoredInFlight,
      lease,
      expiresAt: Date.now() + ttlMs,
    });
    return { claimed: true, lease };
  }

  async complete(
    key: string,
    lease: string,
    fingerprint: string,
    response: StoredResponse,
    ttlMs: number,
  ): Promise<boolean> {
    if (this.current(key)?.lease !== lease) return false;
    this.records.set(key, {
      value: { status: 'COMPLETED', fingerprint, response },
      expiresAt: Date.now() + ttlMs,
    });
    return true;
  }

  async release(key: string, lease: string): Promise<void> {
    if (this.current(key)?.lease === lease) this.records.delete(key);
  }
}
