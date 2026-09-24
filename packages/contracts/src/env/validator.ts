import type { z, ZodType } from 'zod';

export class ConfigurationError extends Error {
  public readonly errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]>) {
    super(message);
    this.name = 'ConfigurationError';
    this.errors = errors;
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Loads .env file using Node.js 24 native process.loadEnvFile if available and file exists.
 */
export function loadEnvFileIfPresent(envPath?: string): void {
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(envPath);
    } catch (error: unknown) {
      if ((error as { code?: string })?.code !== 'ENOENT') {
        console.warn('Warning: Failed to load env file:', error);
      }
    }
  }
}

/**
 * Validates environment variables against a provided Zod schema.
 * Throws a formatted ConfigurationError on failure to ensure immediate startup crash.
 */
export function validateEnv<T extends ZodType>(
  schema: T,
  rawEnv: Record<string, string | undefined> = process.env,
): z.infer<T> {
  const result = schema.safeParse(rawEnv);

  if (!result.success) {
    const formattedErrors: Record<string, string[]> = {};

    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || 'root';
      if (!formattedErrors[key]) {
        formattedErrors[key] = [];
      }
      formattedErrors[key].push(issue.message);
    }

    const errorDetails = Object.entries(formattedErrors)
      .map(([key, messages]) => `  - ${key}: ${messages.join(', ')}`)
      .join('\n');

    const errorMessage = `\n❌ Invalid environment configuration:\n${errorDetails}\n`;
    console.error(errorMessage);

    throw new ConfigurationError(
      `Application failed to start due to invalid configuration:\n${errorDetails}`,
      formattedErrors,
    );
  }

  return result.data;
}
