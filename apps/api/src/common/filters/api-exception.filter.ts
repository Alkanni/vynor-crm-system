import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { type ApiErrorResponse } from '@vynor/contracts';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { IamException } from '../../iam/actor-context.service.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { correlationId?: string }>();

    const correlationId =
      request.correlationId ||
      (request.headers['x-correlation-id'] as string) ||
      `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    response.setHeader('x-correlation-id', correlationId);

    const isProduction = process.env.NODE_ENV === 'production';

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected internal server error occurred.';
    let details: Record<string, unknown> | undefined;

    if (exception instanceof ZodError) {
      statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
      code = 'VALIDATION_FAILED';
      message = 'Request validation failed on one or more fields.';
      details = {
        issues: exception.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      };
    } else if (exception instanceof IamException) {
      statusCode = exception.statusCode;
      code = exception.code;
      message = exception.message;
      if (exception.details) {
        details = exception.details;
      }
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        code = (resObj.code as string) || this.getDefaultCodeForStatus(statusCode);
        message = (resObj.message as string) || exception.message;
        if (resObj.details && typeof resObj.details === 'object') {
          details = resObj.details as Record<string, unknown>;
        }
      } else if (typeof res === 'string') {
        message = res;
        code = this.getDefaultCodeForStatus(statusCode);
      }
    } else if (exception instanceof Error) {
      // Unhandled generic error
      this.logger.error(
        `[UnhandledException] correlationId=${correlationId} error=${exception.message}`,
        exception.stack,
      );

      if (!isProduction) {
        message = exception.message;
        details = { stack: exception.stack };
      }
    }

    const errorResponse: ApiErrorResponse = {
      statusCode,
      code,
      message,
      ...(details ? { details } : {}),
      correlationId,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(errorResponse);
  }

  private getDefaultCodeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.METHOD_NOT_ALLOWED:
        return 'METHOD_NOT_ALLOWED';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'UNPROCESSABLE_ENTITY';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'SERVICE_UNAVAILABLE';
      case HttpStatus.GATEWAY_TIMEOUT:
        return 'GATEWAY_TIMEOUT';
      default:
        return status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'API_ERROR';
    }
  }
}
