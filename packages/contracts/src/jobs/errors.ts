/**
 * Failure category classification for background job execution (FND-053).
 */
export type JobFailureCategory = 'RETRYABLE' | 'TERMINAL' | 'THROTTLED' | 'AUTHENTICATION';

/**
 * Base error class for all background job execution failures.
 */
export class JobExecutionError extends Error {
  readonly category: JobFailureCategory;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    category: JobFailureCategory,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.category = category;
    this.code = code;
    if (details) {
      this.details = details;
    }
  }
}

/**
 * Retryable error for transient network, database, or downstream timeouts (FND-053).
 * Worker will retry with exponential backoff and jitter.
 */
export class RetryableJobError extends JobExecutionError {
  constructor(
    code = 'TRANSIENT_FAILURE',
    message = 'A transient error occurred during job processing.',
    details?: Record<string, unknown>,
  ) {
    super('RETRYABLE', code, message, details);
  }
}

/**
 * Terminal error for unrecoverable domain or validation failures (FND-053).
 * Worker immediately halts retries and routes the job to the Dead-Letter Queue (DLQ).
 */
export class TerminalJobError extends JobExecutionError {
  constructor(
    code = 'TERMINAL_FAILURE',
    message = 'Job failed with an unrecoverable error and cannot be retried.',
    details?: Record<string, unknown>,
  ) {
    super('TERMINAL', code, message, details);
  }
}

/**
 * Throttling error when an external provider responds with HTTP 429 Rate Limited (FND-053).
 * Worker pauses or reschedules the job specifically respecting retryAfterSeconds.
 */
export class ThrottledJobError extends JobExecutionError {
  readonly retryAfterSeconds: number;

  constructor(
    retryAfterSeconds = 30,
    code = 'PROVIDER_THROTTLED',
    message = `Provider rate limit exceeded. Retry after ${retryAfterSeconds}s.`,
    details?: Record<string, unknown>,
  ) {
    super('THROTTLED', code, message, {
      ...details,
      retryAfterSeconds,
    });
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Authentication error when provider API keys or JWT tokens are expired/invalid (FND-053).
 * Halts automated retries until credentials are valid or refreshed.
 */
export class AuthenticationJobError extends JobExecutionError {
  readonly provider: string;

  constructor(
    provider: string,
    code = 'AUTH_CREDENTIALS_INVALID',
    message = `Authentication failed with provider '${provider}'.`,
    details?: Record<string, unknown>,
  ) {
    super('AUTHENTICATION', code, message, {
      ...details,
      provider,
    });
    this.provider = provider;
  }
}

/**
 * Classifies any thrown error into a JobFailureCategory.
 */
export function classifyJobError(error: unknown): JobFailureCategory {
  if (error instanceof JobExecutionError) {
    return error.category;
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('429')) {
      return 'THROTTLED';
    }
    if (
      msg.includes('unauthorized') ||
      msg.includes('forbidden') ||
      msg.includes('401') ||
      msg.includes('403') ||
      msg.includes('invalid credentials')
    ) {
      return 'AUTHENTICATION';
    }
    if (
      msg.includes('validation') ||
      msg.includes('syntax') ||
      msg.includes('malformed') ||
      msg.includes('not found') ||
      msg.includes('404') ||
      msg.includes('422')
    ) {
      return 'TERMINAL';
    }
  }

  // Default to RETRYABLE for unexpected network / server errors
  return 'RETRYABLE';
}
