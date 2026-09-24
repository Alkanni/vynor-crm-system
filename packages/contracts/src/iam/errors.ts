import { z } from 'zod';

export const IamErrorCodeSchema = z.enum([
  'AUTH_TOKEN_MISSING',
  'AUTH_TOKEN_EXPIRED',
  'AUTH_TOKEN_INVALID',
  'USER_ACCOUNT_DISABLED',
  'MEMBERSHIP_NOT_FOUND',
  'MEMBERSHIP_INACTIVE',
  'WORKSPACE_HEADER_MISSING',
  'WORKSPACE_ACCESS_DENIED',
  'PERMISSION_DENIED',
]);

export type IamErrorCode = z.infer<typeof IamErrorCodeSchema>;

export const IamErrorResponseSchema = z.object({
  statusCode: z.number().int(),
  code: IamErrorCodeSchema,
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  correlationId: z.string().optional(),
  timestamp: z.string().datetime(),
});

export type IamErrorResponse = z.infer<typeof IamErrorResponseSchema>;

export const IAM_ERROR_DEFINITIONS: Record<
  IamErrorCode,
  { statusCode: number; defaultMessage: string }
> = {
  AUTH_TOKEN_MISSING: {
    statusCode: 401,
    defaultMessage: 'Authentication required. Bearer token missing from Authorization header.',
  },
  AUTH_TOKEN_EXPIRED: {
    statusCode: 401,
    defaultMessage: 'Authentication token has expired. Please refresh your session.',
  },
  AUTH_TOKEN_INVALID: {
    statusCode: 401,
    defaultMessage: 'Authentication token is invalid or signature verification failed.',
  },
  USER_ACCOUNT_DISABLED: {
    statusCode: 403,
    defaultMessage: 'Your user account has been deactivated or disabled.',
  },
  MEMBERSHIP_NOT_FOUND: {
    statusCode: 403,
    defaultMessage: 'You do not have an active membership in the requested workspace.',
  },
  MEMBERSHIP_INACTIVE: {
    statusCode: 403,
    defaultMessage: 'Your membership in this workspace has been suspended or deactivated.',
  },
  WORKSPACE_HEADER_MISSING: {
    statusCode: 400,
    defaultMessage: 'Workspace context header (x-workspace-id or x-workspace-slug) is required.',
  },
  WORKSPACE_ACCESS_DENIED: {
    statusCode: 403,
    defaultMessage: 'Access to the specified workspace is denied.',
  },
  PERMISSION_DENIED: {
    statusCode: 403,
    defaultMessage: 'You do not have the required permission to perform this action.',
  },
};
