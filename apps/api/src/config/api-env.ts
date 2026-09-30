import { ApiEnvSchema, validateEnv, type ApiEnv } from '@vynor/contracts';

/** DI token for the validated API environment. */
export const API_ENV = Symbol('API_ENV');

let cached: ApiEnv | null = null;

/** Validated API environment (parsed once; main.ts fails fast on invalid config). */
export function getApiEnv(): ApiEnv {
  cached ??= validateEnv(ApiEnvSchema, process.env);
  return cached;
}

/** Test hook: forget the cached env after changing process.env. */
export function resetApiEnvCache(): void {
  cached = null;
}
