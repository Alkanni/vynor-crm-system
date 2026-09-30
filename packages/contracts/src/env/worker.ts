import { z } from 'zod';
import {
  ChannelPollingEnvSchema,
  ChannelRuntimeEnvSchema,
  requiresEncryptionKey,
} from './channels.js';
import { BaseServerEnvSchema } from './common.js';

export const WorkerEnvSchema = BaseServerEnvSchema.extend({
  // Database & pg-boss connection
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().min(1, 'DIRECT_URL is required for migrations'),
  PG_BOSS_SCHEMA: z.string().default('pgboss'),
  PG_BOSS_RETENTION_DAYS: z.coerce.number().int().positive().default(14),

  // Object Storage (RustFS / S3)
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
})
  .extend(ChannelRuntimeEnvSchema.shape)
  .extend(ChannelPollingEnvSchema.shape)
  .superRefine((env, ctx) => {
    if (requiresEncryptionKey(env.APP_ENV) && !env.ENCRYPTION_MASTER_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['ENCRYPTION_MASTER_KEY'],
        message: 'ENCRYPTION_MASTER_KEY is required in staging and production',
      });
    }
  });

export type WorkerEnv = z.infer<typeof WorkerEnvSchema>;
