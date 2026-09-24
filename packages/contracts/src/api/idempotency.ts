import { z } from 'zod';

export const IDEMPOTENCY_HEADER = 'idempotency-key';

/**
 * Validation schema for the Idempotency-Key HTTP header.
 */
export const IdempotencyKeyHeaderSchema = z
  .string()
  .min(8, 'Idempotency-Key must be at least 8 characters long')
  .max(128, 'Idempotency-Key must not exceed 128 characters')
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Idempotency-Key must contain only alphanumeric, dash, and underscore characters',
  );

export type IdempotencyKey = z.infer<typeof IdempotencyKeyHeaderSchema>;

export const IdempotencyStatusSchema = z.enum(['IN_FLIGHT', 'COMPLETED', 'FAILED']);
export type IdempotencyStatus = z.infer<typeof IdempotencyStatusSchema>;

/**
 * Cached idempotency record structure.
 */
export const IdempotencyRecordSchema = z.object({
  key: z.string(),
  workspaceId: z.string(),
  actorId: z.string(),
  route: z.string(),
  status: IdempotencyStatusSchema,
  responseStatus: z.number().int().optional(),
  responseBody: z.unknown().optional(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export type IdempotencyRecord = z.infer<typeof IdempotencyRecordSchema>;
