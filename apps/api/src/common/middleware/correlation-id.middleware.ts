import { Injectable, type NestMiddleware } from '@nestjs/common';
import {
  CAUSATION_ID_HEADER,
  CORRELATION_ID_HEADER,
  isValidCorrelationId,
  resolveCorrelationId,
} from '@vynor/observability';
import type { NextFunction, Request, Response } from 'express';

export interface CorrelatedRequest extends Request {
  correlationId: string;
  causationId?: string;
}

/**
 * Early boundary middleware ensuring every request has a validated correlationId (FND-044).
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlatedReq = req as CorrelatedRequest;
    const correlationId = resolveCorrelationId(
      req.headers as Record<string, string | string[] | undefined>,
    );
    correlatedReq.correlationId = correlationId;

    const causationHeader = req.headers[CAUSATION_ID_HEADER];
    const causationId = Array.isArray(causationHeader) ? causationHeader[0] : causationHeader;
    if (causationId && isValidCorrelationId(causationId)) {
      correlatedReq.causationId = causationId;
    }

    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    next();
  }
}
