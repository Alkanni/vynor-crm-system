import { z } from 'zod';

/** S3-compatible object storage (RustFS locally) shared by the API and worker. */
export const StorageEnvSchema = z.object({
  STORAGE_ENDPOINT: z.string().min(1).default('http://localhost:9000'),
  STORAGE_REGION: z.string().default('us-east-1'),
  STORAGE_BUCKET: z.string().default('vynor-crm-attachments'),
  STORAGE_ACCESS_KEY_ID: z.string().min(1, 'STORAGE_ACCESS_KEY_ID is required'),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1, 'STORAGE_SECRET_ACCESS_KEY is required'),
  STORAGE_USE_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});
export type StorageEnv = z.infer<typeof StorageEnvSchema>;
