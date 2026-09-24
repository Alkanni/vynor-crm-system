import {
  type CallHandler,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import {
  type ActorContext,
  IDEMPOTENCY_HEADER,
  IdempotencyKeyHeaderSchema,
} from '@vynor/contracts';
import type { Request, Response } from 'express';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

interface StoredIdempotency {
  status: 'IN_FLIGHT' | 'COMPLETED' | 'FAILED';
  statusCode?: number;
  body?: unknown;
  expiresAt: number;
}

/**
 * In-memory idempotency store with TTL eviction.
 * In distributed production clusters, this can be swapped with Redis.
 */
class IdempotencyStore {
  private readonly store = new Map<string, StoredIdempotency>();

  get(key: string): StoredIdempotency | undefined {
    const record = this.store.get(key);
    if (!record) return undefined;
    if (Date.now() > record.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return record;
  }

  set(key: string, record: StoredIdempotency): void {
    this.store.set(key, record);
  }

  delete(key: string): void {
    this.store.delete(key);
  }
}

const idempotencyStore = new IdempotencyStore();

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private static readonly TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request & { actor?: ActorContext; correlationId?: string }>();
    const response = ctx.getResponse<Response>();

    // Only apply idempotency to mutating methods
    const isMutatingMethod = ['POST', 'PATCH', 'DELETE'].includes(request.method.toUpperCase());
    if (!isMutatingMethod) {
      return next.handle();
    }

    const rawKey = request.headers[IDEMPOTENCY_HEADER] as string | undefined;
    if (!rawKey) {
      return next.handle();
    }

    // Validate key format
    const keyValidation = IdempotencyKeyHeaderSchema.safeParse(rawKey);
    if (!keyValidation.success) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          code: 'BAD_REQUEST',
          message:
            'Invalid Idempotency-Key header. Must be 8-128 alphanumeric, dash, or underscore characters.',
          correlationId: request.correlationId,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const idempotencyKey = keyValidation.data;
    const workspaceId = request.actor?.workspace?.id ?? 'global';
    const storeKey = `idemp:${workspaceId}:${request.method}:${request.path}:${idempotencyKey}`;

    const existing = idempotencyStore.get(storeKey);

    if (existing) {
      if (existing.status === 'IN_FLIGHT') {
        throw new HttpException(
          {
            statusCode: HttpStatus.CONFLICT,
            code: 'IDEMPOTENCY_CONFLICT',
            message:
              'A request with this Idempotency-Key is currently in progress. Please retry shortly.',
            correlationId: request.correlationId,
            timestamp: new Date().toISOString(),
          },
          HttpStatus.CONFLICT,
        );
      }

      if (existing.status === 'COMPLETED') {
        response.status(existing.statusCode ?? HttpStatus.OK);
        response.setHeader('x-idempotent-replay', 'true');
        return of(existing.body);
      }
    }

    // Mark key as IN_FLIGHT
    idempotencyStore.set(storeKey, {
      status: 'IN_FLIGHT',
      expiresAt: Date.now() + 60 * 1000, // 60s in-flight lock timeout
    });

    return next.handle().pipe(
      tap((body) => {
        const statusCode = response.statusCode || HttpStatus.OK;
        idempotencyStore.set(storeKey, {
          status: 'COMPLETED',
          statusCode,
          body,
          expiresAt: Date.now() + IdempotencyInterceptor.TTL_MS,
        });
      }),
      catchError((err) => {
        idempotencyStore.delete(storeKey);
        throw err;
      }),
    );
  }
}
