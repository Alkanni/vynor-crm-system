import { z } from 'zod';
import { blankAsUnset, ChannelRuntimeEnvSchema, requiresEncryptionKey } from './channels.js';
import { BaseServerEnvSchema } from './common.js';

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

  // S3 / RustFS Object Storage
  STORAGE_ENDPOINT: z.string().min(1).default('http://localhost:9000'),
  STORAGE_REGION: z.string().default('us-east-1'),
  STORAGE_BUCKET: z.string().default('vynor-crm-attachments'),
  STORAGE_ACCESS_KEY_ID: z.string().min(1, 'STORAGE_ACCESS_KEY_ID is required'),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1, 'STORAGE_SECRET_ACCESS_KEY is required'),
  STORAGE_USE_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

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
  .extend(ChannelRuntimeEnvSchema.shape)
  .superRefine((env, ctx) => {
    if (requiresEncryptionKey(env.APP_ENV) && !env.ENCRYPTION_MASTER_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['ENCRYPTION_MASTER_KEY'],
        message: 'ENCRYPTION_MASTER_KEY is required in staging and production',
      });
    }
  });

export type ApiEnv = z.infer<typeof ApiEnvSchema>;
