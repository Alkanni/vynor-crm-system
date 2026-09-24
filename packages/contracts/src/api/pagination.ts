import { z } from 'zod';

export const SortOrderSchema = z.enum(['asc', 'desc']);
export type SortOrder = z.infer<typeof SortOrderSchema>;

export const PaginationDirectionSchema = z.enum(['forward', 'backward']);
export type PaginationDirection = z.infer<typeof PaginationDirectionSchema>;

/**
 * Standard query parameters for cursor-based pagination.
 */
export const PaginationQuerySchema = z.object({
  /** Opaque cursor string pointing to the item after or before which to fetch records */
  cursor: z.string().optional(),
  /** Maximum number of records to return (1-100, default 25) */
  limit: z.coerce.number().int().min(1).max(100).default(25),
  /** Direction of pagination relative to the cursor (default: forward) */
  direction: PaginationDirectionSchema.default('forward'),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/**
 * Standard ISO 8601 date range query parameters for filtering time-series records.
 */
export const DateRangeQuerySchema = z.object({
  startDate: z
    .string()
    .datetime({ message: 'startDate must be a valid ISO 8601 UTC string' })
    .optional(),
  endDate: z
    .string()
    .datetime({ message: 'endDate must be a valid ISO 8601 UTC string' })
    .optional(),
});

export type DateRangeQuery = z.infer<typeof DateRangeQuerySchema>;

/**
 * Metadata block returned inside paginated API responses.
 */
export const PaginationMetaSchema = z.object({
  limit: z.number().int(),
  hasMore: z.boolean(),
  nextCursor: z.string().nullable(),
  prevCursor: z.string().nullable(),
  totalCount: z.number().int().optional(),
});

export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

/**
 * Factory creating a typed paginated response schema for an arbitrary item schema.
 */
export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    pagination: PaginationMetaSchema,
  });
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Encodes an object payload (e.g. `{ id: 'abc', createdAt: '2026-09-24T...' }`)
 * into a URL-safe Base64 cursor string.
 */
export function encodeCursor(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json, 'utf8').toString('base64url');
}

/**
 * Decodes a URL-safe Base64 cursor string back into its original payload object.
 * Returns null if the cursor is invalid or cannot be parsed.
 */
export function decodeCursor<T = Record<string, unknown>>(cursor: string): T | null {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
