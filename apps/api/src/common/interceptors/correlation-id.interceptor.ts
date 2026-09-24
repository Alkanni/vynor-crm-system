import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { type Observable } from 'rxjs';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request & { correlationId?: string }>();
    const response = ctx.getResponse<Response>();

    const correlationId =
      request.correlationId ||
      (request.headers['x-correlation-id'] as string) ||
      `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    request.correlationId = correlationId;
    response.setHeader('x-correlation-id', correlationId);

    return next.handle();
  }
}
