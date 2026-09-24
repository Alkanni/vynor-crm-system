import { z } from 'zod';

export const NodeEnvSchema = z.enum(['development', 'test', 'staging', 'production']);
export type NodeEnv = z.infer<typeof NodeEnvSchema>;

export const AppProfileSchema = z.enum(['local', 'test', 'staging', 'production']);
export type AppProfile = z.infer<typeof AppProfileSchema>;

export const LogLevelSchema = z.enum([
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
]);
export type LogLevel = z.infer<typeof LogLevelSchema>;

export const BaseServerEnvSchema = z.object({
  NODE_ENV: NodeEnvSchema.default('development'),
  APP_ENV: AppProfileSchema.default('local'),
  LOG_LEVEL: LogLevelSchema.default('info'),
  SENTRY_DSN: z.string().url().optional(),
});
export type BaseServerEnv = z.infer<typeof BaseServerEnvSchema>;
