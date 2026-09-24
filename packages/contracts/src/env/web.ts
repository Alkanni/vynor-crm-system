import { z } from 'zod';
import { NodeEnvSchema } from './common.js';

/**
 * Public browser environment schema.
 * All variables MUST begin with NEXT_PUBLIC_ to be safely exposed to the client.
 */
export const PublicWebEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3001'),
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL')
    .default('http://localhost:54321'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required')
    .default('dev-anon-key-placeholder'),
  NEXT_PUBLIC_SOCKET_URL: z.string().url().default('http://localhost:3001'),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
});
export type PublicWebEnv = z.infer<typeof PublicWebEnvSchema>;

/**
 * Server-only Next.js runtime environment schema.
 * These variables are NEVER exposed to the browser bundle.
 */
export const ServerWebEnvSchema = z.object({
  NODE_ENV: NodeEnvSchema.default('development'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});
export type ServerWebEnv = z.infer<typeof ServerWebEnvSchema>;

/**
 * Combined web environment schema.
 */
export const WebEnvSchema = PublicWebEnvSchema.merge(ServerWebEnvSchema);
export type WebEnv = z.infer<typeof WebEnvSchema>;
