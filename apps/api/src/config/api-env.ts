import { ApiEnvSchema, validateEnv, type ApiEnv } from '@vynor/contracts';

/** DI token for the validated API environment. */
export const API_ENV = Symbol('API_ENV');

let cached: ApiEnv | null = null;

/** Validated API environment (parsed once; main.ts fails fast on invalid config). */
export function getApiEnv(): ApiEnv {
  cached ??= validateEnv(ApiEnvSchema, process.env);
  return cached;
}

/** CORS_ALLOWED_ORIGINS as a list; the REST API and the realtime gateway share it. */
export function parseCorsAllowedOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
