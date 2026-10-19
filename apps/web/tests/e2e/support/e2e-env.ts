/**
 * Topology and throwaway secrets of the E2E stack (VYN-03-01).
 *
 * Every secret below is a fixture for a local run against the provider stub: it protects no
 * real data and is never sent to a real provider. Every provider base URL points at the stub,
 * so the API and the worker cannot reach Meta, Telegram, LINE or Supabase during a run.
 */

export const E2E_PORTS = {
  api: 3901,
  web: 3905,
  stub: 3911,
  browser: 3920,
} as const;

export const API_ORIGIN = `http://localhost:${E2E_PORTS.api}`;
export const API_BASE = `${API_ORIGIN}/api/v1`;
export const WEB_ORIGIN = `http://localhost:${E2E_PORTS.web}`;
export const STUB_ORIGIN = `http://127.0.0.1:${E2E_PORTS.stub}`;

const E2E_SECRETS = {
  jwt: 'e2e-only-jwt-secret-not-used-anywhere-else-0123456789',
  // 32 bytes, base64: the credential cipher key the API and the worker share.
  encryptionMasterKey: Buffer.from('vynor-e2e-only-master-key-32byte').toString('base64'),
  supabaseAnonKey: 'e2e-anon-key',
  supabaseServiceRoleKey: 'e2e-service-role-key',
  storageAccessKeyId: 'e2e-storage-key',
  storageSecretAccessKey: 'e2e-storage-secret',
} as const;

/** WhatsApp Cloud accounts the stub knows; the stub answers 404 for any other phone number. */
export const STUB_WABA_ID = '102290129340398';
export const STUB_PHONES = {
  golden: { id: '106540352242922', display: '+62 811-0000-1111', name: 'VYNOR E2E Golden' },
  channelsUi: { id: '106540352242933', display: '+62 811-0000-2222', name: 'VYNOR E2E Channels' },
  screens: { id: '106540352242944', display: '+62 811-0000-3333', name: 'VYNOR E2E Screens' },
  tenantA: { id: '106540352242966', display: '+62 811-0000-5555', name: 'VYNOR E2E Tenant A' },
  tenantB: { id: '106540352242955', display: '+62 811-0000-4444', name: 'VYNOR E2E Tenant B' },
} as const;

/** Seeded and fixture users (dev-session sign-in works for any active user). */
export const E2E_USERS = {
  admin: 'admin@vynor.local',
  agent: 'agent@vynor.local',
  tenantB: 'tenant-b@vynor.test',
  screens: 'screens@vynor.test',
} as const;

function providerBaseUrls(): Record<string, string> {
  return {
    META_GRAPH_API_BASE_URL: `${STUB_ORIGIN}/meta`,
    INSTAGRAM_GRAPH_API_BASE_URL: `${STUB_ORIGIN}/instagram`,
    TELEGRAM_API_BASE_URL: `${STUB_ORIGIN}/telegram`,
    LINE_API_BASE_URL: `${STUB_ORIGIN}/line`,
    LINE_DATA_API_BASE_URL: `${STUB_ORIGIN}/line-data`,
  };
}

function serverEnv(databaseUrl: string): Record<string, string> {
  return {
    // `test` would switch off the outbox dispatcher, the queue consumers and the realtime relay.
    NODE_ENV: 'development',
    APP_ENV: 'test',
    LOG_LEVEL: 'info',
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
    ENCRYPTION_MASTER_KEY: E2E_SECRETS.encryptionMasterKey,
    STORAGE_ACCESS_KEY_ID: E2E_SECRETS.storageAccessKeyId,
    STORAGE_SECRET_ACCESS_KEY: E2E_SECRETS.storageSecretAccessKey,
    ...providerBaseUrls(),
  };
}

export function apiEnv(databaseUrl: string): Record<string, string> {
  return {
    ...serverEnv(databaseUrl),
    PORT: String(E2E_PORTS.api),
    APP_URL: API_ORIGIN,
    CORS_ALLOWED_ORIGINS: WEB_ORIGIN,
    // Valid HS256 tokens are verified locally; anything else falls through to the stub's JWKS.
    SUPABASE_URL: `${STUB_ORIGIN}/supabase`,
    SUPABASE_ANON_KEY: E2E_SECRETS.supabaseAnonKey,
    SUPABASE_SERVICE_ROLE_KEY: E2E_SECRETS.supabaseServiceRoleKey,
    SUPABASE_JWT_SECRET: E2E_SECRETS.jwt,
    AUTH_DEV_SESSION_ENABLED: 'true',
  };
}

export function workerEnv(databaseUrl: string): Record<string, string> {
  return { ...serverEnv(databaseUrl), CHANNEL_POLLING_ENABLED: 'false' };
}

/** NEXT_PUBLIC_* values are inlined at build time, so the web app is built with these. */
export function webEnv(): Record<string, string> {
  return {
    NEXT_PUBLIC_APP_URL: WEB_ORIGIN,
    NEXT_PUBLIC_API_URL: API_ORIGIN,
    NEXT_PUBLIC_SOCKET_URL: API_ORIGIN,
    NEXT_PUBLIC_SUPABASE_URL: `${STUB_ORIGIN}/supabase`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: E2E_SECRETS.supabaseAnonKey,
    NEXT_TELEMETRY_DISABLED: '1',
  };
}
