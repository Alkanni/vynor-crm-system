import { z } from 'zod';

export const DeadLetterActionSchema = z.enum(['RETRY', 'REPLAY', 'ABANDON']);
export type DeadLetterAction = z.infer<typeof DeadLetterActionSchema>;

/**
 * Filter schema for inspecting Dead-Letter Queue items (FND-055).
 */
export const DeadLetterQuerySchema = z.object({
  workspaceId: z.string().optional(),
  queue: z.string().optional(),
  eventType: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
});

export type DeadLetterQuery = z.infer<typeof DeadLetterQuerySchema>;

/**
 * Dead-letter record contract.
 */
export const DeadLetterRecordSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  eventType: z.string().min(1),
  queue: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  lastError: z.string().nullable().optional(),
  retryCount: z.number().int().nonnegative(),
  correlationId: z.string().min(1),
  createdAt: z.string().datetime(),
  deadLetteredAt: z.string().datetime(),
});

export type DeadLetterRecord = z.infer<typeof DeadLetterRecordSchema>;

/**
 * Dead-letter queue remediation command schema (retry, replay, abandon).
 */
export const DeadLetterActionRequestSchema = z.object({
  action: DeadLetterActionSchema,
  jobIds: z.array(z.string().min(1)).min(1),
  reason: z.string().min(1).optional(),
});

export type DeadLetterActionRequest = z.infer<typeof DeadLetterActionRequestSchema>;
