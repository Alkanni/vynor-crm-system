import { z } from 'zod';
import {
  ChannelPollingEnvSchema,
  ChannelRuntimeEnvSchema,
  refineEncryptionKeyRequired,
} from './channels.js';
import { BaseServerEnvSchema, isRedisUrl } from './common.js';
import { StorageEnvSchema } from './storage.js';

export const WorkerEnvSchema = BaseServerEnvSchema.extend({
  // Database & pg-boss connection
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().min(1, 'DIRECT_URL is required for migrations'),
  PG_BOSS_SCHEMA: z.string().default('pgboss'),
  PG_BOSS_RETENTION_DAYS: z.coerce.number().int().positive().default(14),

  /**
   * Redis that carries the BullMQ job queues (WU-05a, DEC-02): redis:// or rediss://, with the
   * password in the URL when Redis requires one. Required in every profile: unlike the API's
   * shared state, a job queue has no per-process fallback.
   */
  REDIS_URL: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z
      .string({ error: 'REDIS_URL is required: background jobs run on BullMQ in Redis' })
      .refine(isRedisUrl, 'REDIS_URL must be a redis:// or rediss:// URL'),
  ),
})
  .extend(StorageEnvSchema.shape)
  .extend(ChannelRuntimeEnvSchema.shape)
  .extend(ChannelPollingEnvSchema.shape)
  .superRefine(refineEncryptionKeyRequired);

export type WorkerEnv = z.infer<typeof WorkerEnvSchema>;
