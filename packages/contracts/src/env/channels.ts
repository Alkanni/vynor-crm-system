import { z } from 'zod';

const booleanFlag = (defaultValue: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(defaultValue)
    .transform((v) => v === 'true');

/**
 * Environment shared by the API and worker for channel integrations (issue #37).
 *
 * Provider base URLs only change in tests, where they point at a local mock server.
 */
export const ChannelRuntimeEnvSchema = z.object({
  /**
   * AES-256-GCM key (32 bytes, base64) that encrypts channel credentials at rest.
   * Generate with: openssl rand -base64 32. Required in staging and production.
   */
  ENCRYPTION_MASTER_KEY: z.string().min(1).optional(),
  /** Identifier stored next to each ciphertext so keys can be rotated. */
  ENCRYPTION_KEY_ID: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,32}$/)
    .default('v1'),
  /** Retired keys still accepted for decryption, e.g. `v0:BASE64KEY,v00:BASE64KEY`. */
  ENCRYPTION_PREVIOUS_KEYS: z.string().optional(),

  META_GRAPH_API_VERSION: z
    .string()
    .regex(/^v\d+\.\d+$/, 'Use the form v26.0')
    .default('v26.0'),
  META_GRAPH_API_BASE_URL: z.string().url().default('https://graph.facebook.com'),
  INSTAGRAM_GRAPH_API_BASE_URL: z.string().url().default('https://graph.instagram.com'),
  TELEGRAM_API_BASE_URL: z.string().url().default('https://api.telegram.org'),
  LINE_API_BASE_URL: z.string().url().default('https://api.line.me'),
  LINE_DATA_API_BASE_URL: z.string().url().default('https://api-data.line.me'),
  /** Timeout for a single provider HTTP call, in milliseconds. */
  CHANNEL_HTTP_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(15_000),
});
export type ChannelRuntimeEnv = z.infer<typeof ChannelRuntimeEnvSchema>;

export const ChannelPollingEnvSchema = z.object({
  /** Run IMAP and Telegram polling loops in this worker process. */
  CHANNEL_POLLING_ENABLED: booleanFlag('true'),
  EMAIL_POLL_INTERVAL_SECONDS: z.coerce.number().int().min(5).max(3600).default(30),
  TELEGRAM_POLL_INTERVAL_SECONDS: z.coerce.number().int().min(1).max(300).default(3),
});
export type ChannelPollingEnv = z.infer<typeof ChannelPollingEnvSchema>;

/** Profiles where plaintext-by-accident must be impossible. */
export function requiresEncryptionKey(appEnv: string): boolean {
  return appEnv === 'staging' || appEnv === 'production';
}
