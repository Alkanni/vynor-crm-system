import { z } from 'zod';
import { blankAsUnset, ChannelRuntimeEnvSchema, refineEncryptionKeyRequired } from './channels.js';
import { BaseServerEnvSchema } from './common.js';
import { StorageEnvSchema } from './storage.js';

export const ApiEnvSchema = BaseServerEnvSchema.extend({
  PORT: z.coerce.number().int().positive().default(3001),
  APP_URL: z.string().url().default('http://localhost:3001'),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  // Database (Supabase PostgreSQL)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().min(1, 'DIRECT_URL is required for migrations'),

  // Supabase Auth & JWT
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  SUPABASE_JWT_SECRET: z.string().min(1, 'SUPABASE_JWT_SECRET is required'),

  /**
   * Redis that every API instance shares for Idempotency-Key records and the web chat rate
   * limits (WU-04, DEC-04): redis:// or rediss://, with the password in the URL when Redis
   * requires one. Required unless SHARED_STATE_STORE=memory.
   */
  REDIS_URL: blankAsUnset(
    z.string().refine(isRedisUrl, 'REDIS_URL must be a redis:// or rediss:// URL'),
  ),

  /**
   * `memory` keeps that state in this process instead, so it does not hold across instances
   * or restarts. Only local and test profiles may opt into it; leave unset to use REDIS_URL.
   */
  SHARED_STATE_STORE: blankAsUnset(z.enum(['redis', 'memory'])),

  /**
   * Public HTTPS origin providers use to reach this API (e.g. https://crm.example.com or a
   * tunnel URL). Webhook URLs are built from it. Defaults to APP_URL. Without https, Telegram
   * falls back to polling and Meta/LINE webhooks cannot be registered.
   */
  PUBLIC_WEBHOOK_BASE_URL: blankAsUnset(z.string().url()),

  /**
   * Local-only helper: POST /api/v1/auth/dev-session issues a session for a seeded user so
   * the web app can be used without a Supabase project. Ignored outside local/test profiles.
   */
  AUTH_DEV_SESSION_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
})
  .extend(StorageEnvSchema.shape)
  .extend(ChannelRuntimeEnvSchema.shape)
  .superRefine(refineEncryptionKeyRequired)
  .superRefine(refineSharedStateStore);

export type ApiEnv = z.infer<typeof ApiEnvSchema>;

export type SharedStateStore = 'redis' | 'memory';

function isRedisUrl(value: string): boolean {
  try {
    return ['redis:', 'rediss:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

interface SharedStateEnv {
  NODE_ENV: string;
  APP_ENV: string;
  REDIS_URL?: string | undefined;
  SHARED_STATE_STORE?: SharedStateStore | undefined;
}

/** Where the API keeps state that must hold across instances (validated by ApiEnvSchema). */
export function sharedStateStore(env: SharedStateEnv): SharedStateStore {
  return env.SHARED_STATE_STORE ?? 'redis';
}

/**
 * `superRefine` check (DEC-04): Redis unless a local or test process explicitly opts into the
 * per-process store. NODE_ENV is checked too, because APP_ENV defaults to `local`.
 */
export function refineSharedStateStore(env: SharedStateEnv, ctx: z.RefinementCtx): void {
  if (sharedStateStore(env) === 'memory') {
    const localProfile = env.APP_ENV === 'local' || env.APP_ENV === 'test';
    const localNode = env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
    if (!localProfile || !localNode) {
      ctx.addIssue({
        code: 'custom',
        path: ['SHARED_STATE_STORE'],
        message:
          'SHARED_STATE_STORE=memory is only allowed with APP_ENV local or test and NODE_ENV development or test; set REDIS_URL instead',
      });
    }
    return;
  }
  if (!env.REDIS_URL) {
    ctx.addIssue({
      code: 'custom',
      path: ['REDIS_URL'],
      message:
        'REDIS_URL is required: idempotency keys and web chat rate limits are shared through Redis. A single local or test process may set SHARED_STATE_STORE=memory instead',
    });
  }
}
