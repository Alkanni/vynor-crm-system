/**
 * The E2E harness truncates and reseeds whatever database it is given, so it only ever accepts
 * the disposable test databases (VYN-03-01). The live run (`vynor_crm`), the old dev database
 * (`vynor`) and any other name are refused before a single connection is opened.
 */
export const SAFE_E2E_DATABASES = ['vynor_e2e', 'vynor_test', 'vynor_shadow'] as const;

export class UnsafeDatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeDatabaseError';
  }
}

/** Returns the database name of `rawUrl`, or throws when it is not a safe test database. */
export function assertSafeE2eDatabaseUrl(rawUrl: string | undefined): string {
  if (!rawUrl) {
    throw new UnsafeDatabaseError(
      'E2E_DATABASE_URL is not set. Point it at the disposable vynor_e2e database, e.g. ' +
        'postgresql://postgres:postgres@localhost:5432/vynor_e2e?schema=public',
    );
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeDatabaseError('E2E_DATABASE_URL is not a valid URL.');
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new UnsafeDatabaseError('E2E_DATABASE_URL must be a postgresql:// URL.');
  }
  // A libpq-style `dbname` parameter could override the path, so it is not accepted at all.
  if (url.searchParams.has('dbname')) {
    throw new UnsafeDatabaseError('E2E_DATABASE_URL must not carry a dbname parameter.');
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!(SAFE_E2E_DATABASES as readonly string[]).includes(database)) {
    throw new UnsafeDatabaseError(
      `Refusing database "${database || '(none)'}": the E2E harness only runs against ` +
        `${SAFE_E2E_DATABASES.join(', ')}.`,
    );
  }
  return database;
}

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/**
 * The API under test keeps Idempotency-Key records and web chat rate limits in Redis (WU-04).
 * The harness writes there through the API, so it only accepts a Redis on this machine (the CI
 * service container or a disposable local one), never a shared or remote instance.
 */
export function assertSafeE2eRedisUrl(rawUrl: string | undefined): string {
  if (!rawUrl) {
    throw new UnsafeDatabaseError(
      'E2E_REDIS_URL is not set. Point it at a disposable local Redis, e.g. ' +
        'redis://127.0.0.1:56379/0',
    );
  }
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeDatabaseError('E2E_REDIS_URL is not a valid URL.');
  }
  if (url.protocol !== 'redis:') {
    throw new UnsafeDatabaseError('E2E_REDIS_URL must be a redis:// URL.');
  }
  if (!LOOPBACK_HOSTS.includes(url.hostname)) {
    throw new UnsafeDatabaseError(
      `Refusing Redis host "${url.hostname}": the E2E harness only uses a local Redis.`,
    );
  }
  return rawUrl;
}
