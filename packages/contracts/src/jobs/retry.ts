import { z } from 'zod';

export const JobRetryPolicySchema = z.object({
  maxAttempts: z.number().int().positive().default(5),
  initialDelaySeconds: z.number().int().positive().default(5),
  maxDelaySeconds: z.number().int().positive().default(300),
  backoffFactor: z.number().positive().default(2),
  jitter: z.boolean().default(true),
  timeoutSeconds: z.number().int().positive().default(60),
});

export type JobRetryPolicy = z.infer<typeof JobRetryPolicySchema>;

export const DEFAULT_JOB_RETRY_POLICY: JobRetryPolicy = {
  maxAttempts: 5,
  initialDelaySeconds: 5,
  maxDelaySeconds: 300,
  backoffFactor: 2,
  jitter: true,
  timeoutSeconds: 60,
};

/**
 * Calculates exponential backoff delay with jitter (FND-054, AD-005).
 * Prevents thundering herd problems when downstream services recover.
 */
export function calculateJobRetryDelay(
  attempt: number,
  policy: Partial<JobRetryPolicy> = {},
): number {
  const merged: JobRetryPolicy = { ...DEFAULT_JOB_RETRY_POLICY, ...policy };

  if (attempt <= 1) {
    return merged.initialDelaySeconds;
  }

  const baseDelay = Math.min(
    merged.maxDelaySeconds,
    merged.initialDelaySeconds * Math.pow(merged.backoffFactor, attempt - 1),
  );

  if (!merged.jitter) {
    return Math.round(baseDelay);
  }

  // Full Jitter: randomize between 50% and 100% of base delay
  const randomized = baseDelay * (0.5 + Math.random() * 0.5);
  return Math.max(1, Math.round(randomized));
}
