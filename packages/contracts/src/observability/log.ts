import { z } from 'zod';

export const PinoLogLevelSchema = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']);

export type PinoLogLevel = z.infer<typeof PinoLogLevelSchema>;

export const LogErrorSchema = z.object({
  type: z.string().optional(),
  message: z.string(),
  stack: z.string().optional(),
  code: z.string().optional(),
});

export type LogError = z.infer<typeof LogErrorSchema>;

/**
 * Pino JSON Log Record Schema (FND-043)
 * Enforces mandatory structured log fields: level, correlationId, workspaceId, actorId, time, service, and msg.
 */
export const PinoLogRecordSchema = z.object({
  /** Log level: numeric (Pino default: 10, 20, 30, 40, 50, 60) or label */
  level: z.union([z.number(), PinoLogLevelSchema]),
  /** Epoch timestamp in ms or ISO 8601 string */
  time: z.union([z.number(), z.string()]),
  /** Process ID */
  pid: z.number().optional(),
  /** Hostname running the service */
  hostname: z.string().optional(),
  /** Service identifier (e.g. 'vynor-api', 'vynor-worker', 'vynor-web') */
  service: z.string().min(1),
  /** Environment ('development' | 'test' | 'staging' | 'production') */
  environment: z.string().min(1),
  /** Mandatory request/execution correlation ID (FND-044) */
  correlationId: z.string().min(1),
  /** Optional causation ID linking to predecessor event/command */
  causationId: z.string().optional(),
  /** Workspace ID partition context */
  workspaceId: z.string().optional(),
  /** User or internal actor profile ID */
  actorId: z.string().optional(),
  /** Actor classification ('user' | 'system' | 'ai' | 'webhook') */
  actorType: z.enum(['user', 'system', 'ai', 'webhook']).optional(),
  /** Context label (e.g. class or controller name) */
  context: z.string().optional(),
  /** Log message */
  msg: z.string(),
  /** Structured error object if logged */
  err: LogErrorSchema.optional(),
  /** Additional custom metadata fields */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type PinoLogRecord = z.infer<typeof PinoLogRecordSchema>;
