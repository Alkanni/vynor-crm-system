import pino, { type Logger, type LoggerOptions } from 'pino';
import { PINO_REDACT_PATHS, REDACTED_PLACEHOLDER } from '@vynor/contracts';

export type { Logger } from 'pino';

export interface AppLoggerOptions {
  service: string;
  environment?: string;
  level?: string;
  redactPaths?: string[];
}

export interface LogContext {
  correlationId: string;
  causationId?: string;
  workspaceId?: string;
  actorId?: string;
  actorType?: 'user' | 'system' | 'ai' | 'webhook';
  context?: string;
}

/**
 * Creates a configured Pino JSON logger enforcing mandatory fields and sensitive-field redaction (FND-043, FND-046).
 */
export function createLogger(options: AppLoggerOptions): Logger {
  const env = options.environment || process.env.NODE_ENV || 'development';
  const defaultLevel = options.level || (env === 'production' ? 'info' : 'debug');

  const pinoOptions: LoggerOptions = {
    level: defaultLevel,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    base: {
      service: options.service,
      environment: env,
      pid: process.pid,
    },
    redact: {
      paths: options.redactPaths || PINO_REDACT_PATHS,
      censor: REDACTED_PLACEHOLDER,
    },
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
  };

  return pino(pinoOptions);
}

/**
 * Helper to create a child logger bound to correlation and tenant context (FND-044, FND-045).
 */
export function createChildLogger(parent: Logger, context: LogContext): Logger {
  const bindings: Record<string, unknown> = {
    correlationId: context.correlationId,
  };

  if (context.causationId) {
    bindings.causationId = context.causationId;
  }
  if (context.workspaceId) {
    bindings.workspaceId = context.workspaceId;
  }
  if (context.actorId) {
    bindings.actorId = context.actorId;
  }
  if (context.actorType) {
    bindings.actorType = context.actorType;
  }
  if (context.context) {
    bindings.context = context.context;
  }

  return parent.child(bindings);
}
