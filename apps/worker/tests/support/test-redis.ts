import { WorkerEnvSchema, type WorkerEnv } from '@vynor/contracts';

/**
 * Redis for the BullMQ specs (TEST_REDIS_URL), like the test database a disposable local
 * instance: CI runs a Redis service container. Specs only touch queues under their own unique
 * names, but a Redis outside this machine is refused all the same.
 */
export function testRedisUrl(): string {
  const url = process.env.TEST_REDIS_URL;
  if (!url) {
    throw new Error(
      'No test Redis configured. Set TEST_REDIS_URL to a disposable local Redis ' +
        '(for example redis://127.0.0.1:56379/0) before running the worker integration tests.',
    );
  }
  const { hostname } = new URL(url);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(hostname)) {
    throw new Error(`TEST_REDIS_URL must point at a local Redis, got host ${hostname}`);
  }
  return url;
}

/** A Redis URL for specs that never connect: port 9 (discard) is closed on this machine. */
export const UNUSED_REDIS_URL = 'redis://127.0.0.1:9/0';

/** Worker environment for the specs; the database comes from the runner's own env. */
export function testWorkerEnv(overrides: Record<string, string> = {}): WorkerEnv {
  return WorkerEnvSchema.parse({
    APP_ENV: 'test',
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://unused',
    DIRECT_URL: 'postgresql://unused',
    REDIS_URL: UNUSED_REDIS_URL,
    STORAGE_ACCESS_KEY_ID: 'key',
    STORAGE_SECRET_ACCESS_KEY: 'secret',
    ...overrides,
  });
}
