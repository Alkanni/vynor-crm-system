import { HttpException } from '@nestjs/common';

/**
 * HTTP error with a machine-readable code, rendered by ApiExceptionFilter as the standard
 * error envelope (FND-037).
 */
export function apiError(
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): HttpException {
  return new HttpException(
    { statusCode, code, message, ...(details ? { details } : {}) },
    statusCode,
  );
}

export const notFound = (message: string, code = 'RESOURCE_NOT_FOUND') =>
  apiError(404, code, message);
