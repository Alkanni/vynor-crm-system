import { z } from 'zod';

export const ApiErrorCodeSchema = z.enum([
  // HTTP Protocol & Validation Errors
  'BAD_REQUEST',
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'CONFLICT',
  'IDEMPOTENCY_CONFLICT',
  'UNPROCESSABLE_ENTITY',
  'RATE_LIMITED',
  'INTERNAL_SERVER_ERROR',
  'SERVICE_UNAVAILABLE',
  'GATEWAY_TIMEOUT',

  // Authentication & IAM Errors (AD-007, AD-009)
  'AUTH_TOKEN_MISSING',
  'AUTH_TOKEN_EXPIRED',
  'AUTH_TOKEN_INVALID',
  'USER_ACCOUNT_DISABLED',
  'MEMBERSHIP_NOT_FOUND',
  'MEMBERSHIP_INACTIVE',
  'WORKSPACE_HEADER_MISSING',
  'WORKSPACE_ACCESS_DENIED',
  'PERMISSION_DENIED',

  // Webhook & Channel Provider Errors (AD-004, AD-005)
  'WEBHOOK_SIGNATURE_INVALID',
  'WEBHOOK_PAYLOAD_MALFORMED',
  'CHANNEL_PROVIDER_ERROR',
]);

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

/**
 * Standard RFC-7807 compliant error envelope returned by all VYNOR API endpoints.
 */
export const ApiErrorResponseSchema = z.object({
  statusCode: z.number().int().min(400).max(599),
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional(),
  correlationId: z.string().min(1),
  timestamp: z.string().datetime(),
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

/**
 * Standard success envelope wrapping API responses.
 */
export function createSuccessResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: dataSchema,
    meta: z.record(z.string(), z.unknown()).optional(),
  });
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

/**
 * Helper factory to build a standard success envelope.
 */
export function createSuccessEnvelope<T>(
  data: T,
  meta?: Record<string, unknown>,
): ApiSuccessResponse<T> {
  const envelope: ApiSuccessResponse<T> = { data };
  if (meta) {
    envelope.meta = meta;
  }
  return envelope;
}

/**
 * Helper factory to build a standard error envelope.
 */
export function createErrorEnvelope(params: {
  statusCode: number;
  code: ApiErrorCode | string;
  message: string;
  correlationId: string;
  details?: Record<string, unknown>;
}): ApiErrorResponse {
  const envelope: ApiErrorResponse = {
    statusCode: params.statusCode,
    code: params.code,
    message: params.message,
    correlationId: params.correlationId,
    timestamp: new Date().toISOString(),
  };

  if (params.details) {
    envelope.details = params.details;
  }

  return envelope;
}
