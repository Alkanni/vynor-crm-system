import { validateEnv, WorkerEnvSchema, type WorkerEnv } from '@vynor/contracts';

/** DI token for the validated worker environment. */
export const WORKER_ENV = Symbol('WORKER_ENV');

let cached: WorkerEnv | null = null;

export function getWorkerEnv(): WorkerEnv {
  cached ??= validateEnv(WorkerEnvSchema, process.env);
  return cached;
}
