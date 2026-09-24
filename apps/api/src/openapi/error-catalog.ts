export interface ErrorCatalogEntry {
  readonly code: string;
  readonly httpStatus: number;
  readonly category: 'AUTH' | 'IAM' | 'VALIDATION' | 'STORAGE' | 'CONCURRENCY' | 'SYSTEM';
  readonly description: string;
  readonly safeClientMessage: string;
  readonly actionableGuidance: string;
}

/**
 * Canonical catalog of machine-readable error codes (FND-BE-010, FND-037).
 */
export const ERROR_CATALOG: readonly ErrorCatalogEntry[] = [
  {
    code: 'BAD_REQUEST',
    httpStatus: 400,
    category: 'VALIDATION',
    description: 'The request syntax is invalid or required HTTP headers are missing.',
    safeClientMessage: 'The request could not be processed due to invalid syntax.',
    actionableGuidance: 'Check request syntax, headers, and query parameters before retrying.',
  },
  {
    code: 'AUTH_TOKEN_MISSING',
    httpStatus: 401,
    category: 'AUTH',
    description: 'No Bearer token was provided in the Authorization header.',
    safeClientMessage: 'Authentication credentials are required to access this resource.',
    actionableGuidance: 'Provide a valid Supabase access token in the Authorization header.',
  },
  {
    code: 'AUTH_TOKEN_INVALID',
    httpStatus: 401,
    category: 'AUTH',
    description: 'The supplied JWT token failed signature verification or has expired.',
    safeClientMessage: 'The provided access token is invalid or expired.',
    actionableGuidance: 'Refresh the access token via Supabase Auth and retry the request.',
  },
  {
    code: 'USER_PROFILE_INACTIVE',
    httpStatus: 403,
    category: 'IAM',
    description: 'The user account has been disabled or deactivated.',
    safeClientMessage: 'Your user account is inactive. Contact your workspace administrator.',
    actionableGuidance: 'Contact workspace admin or customer support to reactivate the account.',
  },
  {
    code: 'WORKSPACE_MEMBERSHIP_NOT_FOUND',
    httpStatus: 403,
    category: 'IAM',
    description: 'The authenticated user does not belong to the requested workspace.',
    safeClientMessage: 'You do not have access to the requested workspace.',
    actionableGuidance: 'Verify the x-workspace-id header or request an invitation to join.',
  },
  {
    code: 'WORKSPACE_MEMBERSHIP_INACTIVE',
    httpStatus: 403,
    category: 'IAM',
    description: 'The user membership in this workspace has been suspended or deleted.',
    safeClientMessage: 'Your workspace membership is suspended or removed.',
    actionableGuidance: 'Contact your workspace administrator to restore membership.',
  },
  {
    code: 'PERMISSION_DENIED',
    httpStatus: 403,
    category: 'IAM',
    description: 'The actor lacks one or more required permissions for this action.',
    safeClientMessage: 'Forbidden: Insufficient permissions to perform this operation.',
    actionableGuidance: 'Request role assignment with the missing permission(s) listed in details.',
  },
  {
    code: 'RESOURCE_NOT_FOUND',
    httpStatus: 404,
    category: 'SYSTEM',
    description: 'The requested resource does not exist.',
    safeClientMessage: 'The requested resource was not found.',
    actionableGuidance: 'Verify the resource identifier in the URL path.',
  },
  {
    code: 'ATTACHMENT_NOT_FOUND',
    httpStatus: 404,
    category: 'STORAGE',
    description: 'The requested attachment does not exist within the active workspace.',
    safeClientMessage: 'The requested attachment does not exist in this workspace.',
    actionableGuidance: 'Verify attachment ID and workspace context.',
  },
  {
    code: 'IDEMPOTENCY_KEY_REUSED',
    httpStatus: 409,
    category: 'CONCURRENCY',
    description: 'An idempotency key was reused with a different request payload or method.',
    safeClientMessage: 'Idempotency key was previously used with different request parameters.',
    actionableGuidance: 'Generate a new UUIDv7 / unique idempotency key for new mutations.',
  },
  {
    code: 'IDEMPOTENCY_IN_FLIGHT',
    httpStatus: 409,
    category: 'CONCURRENCY',
    description: 'A request with the specified idempotency key is currently being executed.',
    safeClientMessage: 'A request with this idempotency key is currently processing.',
    actionableGuidance: 'Wait for the current operation to complete before retrying.',
  },
  {
    code: 'ATTACHMENT_EXPIRED',
    httpStatus: 410,
    category: 'STORAGE',
    description: 'The attachment has exceeded its retention policy and was purged.',
    safeClientMessage: 'Attachment has expired and has been permanently purged.',
    actionableGuidance: 'Expired attachments cannot be recovered.',
  },
  {
    code: 'ATTACHMENT_DELETED',
    httpStatus: 410,
    category: 'STORAGE',
    description: 'The attachment was soft-deleted by an agent or user.',
    safeClientMessage: 'Attachment has been deleted.',
    actionableGuidance: 'Contact workspace admin if restoration is needed.',
  },
  {
    code: 'VALIDATION_FAILED',
    httpStatus: 422,
    category: 'VALIDATION',
    description: 'The request body or parameters failed schema validation rules.',
    safeClientMessage: 'Request validation failed on one or more fields.',
    actionableGuidance: 'Inspect details.issues array for field-level error messages.',
  },
  {
    code: 'ATTACHMENT_NOT_CLEAN',
    httpStatus: 422,
    category: 'STORAGE',
    description: 'The attachment is undergoing malware scanning or was flagged as infected.',
    safeClientMessage: 'Attachment is not clean or malware scan is pending/failed.',
    actionableGuidance: 'Wait for scan completion. Infected files are blocked permanently.',
  },
  {
    code: 'ATTACHMENT_QUARANTINED',
    httpStatus: 422,
    category: 'STORAGE',
    description: 'The attachment is currently in the quarantine storage zone.',
    safeClientMessage: 'Attachment is currently quarantined and cannot be downloaded.',
    actionableGuidance: 'Quarantined attachments must be validated before access is granted.',
  },
  {
    code: 'RATE_LIMITED',
    httpStatus: 429,
    category: 'SYSTEM',
    description: 'Too many requests were sent in a given time window.',
    safeClientMessage: 'Rate limit exceeded. Please back off before retrying.',
    actionableGuidance: 'Respect the Retry-After header and implement exponential backoff.',
  },
  {
    code: 'INTERNAL_SERVER_ERROR',
    httpStatus: 500,
    category: 'SYSTEM',
    description: 'An unexpected internal error occurred on the server.',
    safeClientMessage: 'An unexpected internal server error occurred.',
    actionableGuidance: 'Quote the x-correlation-id when contacting technical support.',
  },
  {
    code: 'SERVICE_UNAVAILABLE',
    httpStatus: 503,
    category: 'SYSTEM',
    description: 'A required downstream service or database is temporarily unavailable.',
    safeClientMessage: 'Service temporarily unavailable. Please retry shortly.',
    actionableGuidance: 'Check service status and retry with jittered exponential backoff.',
  },
];
