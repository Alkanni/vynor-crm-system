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

  // Optional Redis
  REDIS_URL: z.string().url().optional(),

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
  .superRefine(refineEncryptionKeyRequired);

export type ApiEnv = z.infer<typeof ApiEnvSchema>;
