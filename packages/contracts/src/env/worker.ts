import { z } from 'zod';
import {
  ChannelPollingEnvSchema,
  ChannelRuntimeEnvSchema,
  refineEncryptionKeyRequired,
} from './channels.js';
import { BaseServerEnvSchema } from './common.js';
import { StorageEnvSchema } from './storage.js';

export const WorkerEnvSchema = BaseServerEnvSchema.extend({
  // Database & pg-boss connection
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().min(1, 'DIRECT_URL is required for migrations'),
  PG_BOSS_SCHEMA: z.string().default('pgboss'),
  PG_BOSS_RETENTION_DAYS: z.coerce.number().int().positive().default(14),

  // Optional Redis
  REDIS_URL: z.string().url().optional(),
})
  .extend(StorageEnvSchema.shape)
  .extend(ChannelRuntimeEnvSchema.shape)
  .extend(ChannelPollingEnvSchema.shape)
  .superRefine(refineEncryptionKeyRequired);

export type WorkerEnv = z.infer<typeof WorkerEnvSchema>;
