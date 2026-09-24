import { Prisma, PrismaClient } from '@prisma/client';

export interface RetryPolicy {
  /** Maximum number of retry attempts for transient concurrency errors (default: 3). */
  maxRetries?: number;
  /** Initial delay before the first retry in milliseconds (default: 50). */
  initialDelayMs?: number;
  /** Maximum upper bound for retry delay in milliseconds (default: 1000). */
  maxDelayMs?: number;
  /** Exponential backoff factor multiplier (default: 2). */
  factor?: number;
  /** Whether to apply random jitter to avoid thundering herd contention (default: true). */
  jitter?: boolean;
  /** Optional callback invoked on each retry attempt. */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

export interface TransactionOptions extends RetryPolicy {
  /** Maximum duration in ms that the interactive transaction can run before timing out (default: 10000ms). */
  timeout?: number;
  /** Maximum duration in ms that Prisma Client will wait to acquire a transaction connection (default: 5000ms). */
  maxWait?: number;
  /** Transaction isolation level (default: ReadCommitted or PostgreSQL default). */
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

/**
 * PostgreSQL error codes for retryable transaction conflicts:
 * - 40001: serialization_failure (concurrent transaction conflict in SERIALIZABLE or REPEATABLE READ)
 * - 40P01: deadlock_detected (deadlock detected between two or more competing locks)
 */
export const RETRYABLE_SQLSTATE_CODES = ['40001', '40P01'] as const;

/**
 * Prisma error code for transaction write conflicts or deadlocks:
 * - P2034: Transaction failed due to a write conflict or a deadlock. Please retry your transaction.
 */
export const PRISMA_DEADLOCK_ERROR_CODE = 'P2034';

/**
 * Determines whether a thrown database error is a transient concurrency error
 * (serialization failure or deadlock) that is safe to retry.
 */
export function isRetryableTransactionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  // Check PrismaClientKnownRequestError
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === PRISMA_DEADLOCK_ERROR_CODE) {
      return true;
    }

    const meta = error.meta as Record<string, unknown> | undefined;
    if (meta && typeof meta.code === 'string') {
      if (
        RETRYABLE_SQLSTATE_CODES.includes(meta.code as (typeof RETRYABLE_SQLSTATE_CODES)[number])
      ) {
        return true;
      }
    }
  }

  // Check generic error message for PostgreSQL SQLSTATE or deadlock phrasing
  if ('message' in error && typeof (error as { message: unknown }).message === 'string') {
    const msg = (error as { message: string }).message;
    if (
      msg.includes('40001') ||
      msg.includes('40P01') ||
      msg.includes('serialization_failure') ||
      msg.includes('deadlock detected') ||
      msg.includes('could not serialize access')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Calculates exponential backoff delay with optional random jitter.
 */
export function calculateBackoffDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  factor: number,
  jitter: boolean,
): number {
  const baseDelay = Math.min(maxDelayMs, initialDelayMs * Math.pow(factor, attempt - 1));
  if (!jitter) {
    return Math.round(baseDelay);
  }
  // Apply jitter between 50% and 100% of baseDelay
  const randomized = baseDelay * (0.5 + Math.random() * 0.5);
  return Math.round(randomized);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Executes a function within a Prisma interactive transaction, automatically retrying
 * with exponential backoff and jitter if a serialization failure (40001) or deadlock (40P01 / P2034) occurs.
 *
 * @param prisma The PrismaClient instance.
 * @param fn The callback function receiving the TransactionClient.
 * @param options Transaction isolation, timeout, and retry configuration options.
 * @returns Result of the transaction callback.
 */
export async function withTransaction<T>(
  prisma: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 50,
    maxDelayMs = 1000,
    factor = 2,
    jitter = true,
    timeout = 10000,
    maxWait = 5000,
    isolationLevel,
    onRetry,
  } = options;

  let attempt = 0;

  const txOptions: {
    timeout?: number;
    maxWait?: number;
    isolationLevel?: Prisma.TransactionIsolationLevel;
  } = {};

  if (timeout !== undefined) txOptions.timeout = timeout;
  if (maxWait !== undefined) txOptions.maxWait = maxWait;
  if (isolationLevel !== undefined) txOptions.isolationLevel = isolationLevel;

  while (true) {
    attempt++;
    try {
      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        return await fn(tx);
      }, txOptions);
    } catch (error) {
      const isRetryable = isRetryableTransactionError(error);
      const hasRetriesLeft = attempt <= maxRetries;

      if (!isRetryable || !hasRetriesLeft) {
        throw error;
      }

      const delayMs = calculateBackoffDelay(attempt, initialDelayMs, maxDelayMs, factor, jitter);

      if (onRetry) {
        try {
          onRetry(attempt, error, delayMs);
        } catch {
          // Prevent onRetry logger failure from aborting transaction retry loop
        }
      }

      await sleep(delayMs);
    }
  }
}
