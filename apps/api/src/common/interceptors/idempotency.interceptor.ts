import { createHash } from 'node:crypto';
import {
  type CallHandler,
  type ExecutionContext,
  HttpStatus,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import {
  type ActorContext,
  IDEMPOTENCY_HEADER,
  IdempotencyKeyHeaderSchema,
} from '@vynor/contracts';
import type { Request, Response } from 'express';
import { from, type Observable, of, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import {
  idempotencyRecordKey,
  type IdempotencyRecord,
  type IdempotencyStore,
} from '../../redis/idempotency-store.js';
import { apiError } from '../errors/api-error.js';

/**
 * Idempotency-Key handling for mutating requests (FND-040), over a store every API instance
 * shares (WU-04): the first request with a key runs, a repeat with the same payload gets the
 * stored response, a repeat with another payload is rejected, and a repeat while the first is
 * still running gets 409. When the store is unreachable the request is refused with 503 before
 * the handler runs (fail closed, DEC-04). Requests without the header never touch the store.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  /** Completed responses are replayed for this long. */
  private static readonly TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  /** A request that neither completes nor fails (crashed instance) frees its key after this. */
  private static readonly IN_FLIGHT_TTL_MS = 60 * 1000;

  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(private readonly store: IdempotencyStore) {}

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
      throw apiError(
        HttpStatus.BAD_REQUEST,
        'BAD_REQUEST',
        'Invalid Idempotency-Key header. Must be 8-128 alphanumeric, dash, or underscore characters.',
      );
    }

    const workspaceId = request.actor?.workspace?.id ?? 'global';
    const recordKey = idempotencyRecordKey(
      workspaceId,
      request.method,
      request.path,
      keyValidation.data,
    );
    const fingerprint = requestFingerprint(request);

    return from(this.claim(recordKey, fingerprint)).pipe(
      mergeMap((claim) => {
        if (!claim.claimed) {
          return of(answerFromRecord(claim.record, fingerprint, response));
        }
        return next.handle().pipe(
          mergeMap(async (body: unknown) => {
            await this.complete(recordKey, claim.lease, fingerprint, response, body);
            return body;
          }),
          catchError((err: unknown) =>
            from(this.release(recordKey, claim.lease)).pipe(mergeMap(() => throwError(() => err))),
          ),
        );
      }),
    );
  }

  private async claim(recordKey: string, fingerprint: string) {
    try {
      return await this.store.claim(
        recordKey,
        fingerprint,
        IdempotencyInterceptor.IN_FLIGHT_TTL_MS,
      );
    } catch (err) {
      this.logger.warn(`Idempotency store unavailable, request refused: ${errorMessage(err)}`);
      throw apiError(
        HttpStatus.SERVICE_UNAVAILABLE,
        'SERVICE_UNAVAILABLE',
        'Requests with an Idempotency-Key cannot be processed right now. Please retry shortly.',
      );
    }
  }

  /**
   * The mutation has already run, so a store failure here must not fail the response; the key
   * then stays IN_FLIGHT (409 for repeats) until the in-flight TTL ends.
   */
  private async complete(
    recordKey: string,
    lease: string,
    fingerprint: string,
    response: Response,
    body: unknown,
  ): Promise<void> {
    const statusCode = response.statusCode || HttpStatus.OK;
    try {
      const stored = await this.store.complete(
        recordKey,
        lease,
        fingerprint,
        { statusCode, body },
        IdempotencyInterceptor.TTL_MS,
      );
      if (!stored) {
        this.logger.warn(
          'Idempotency key expired before its request completed; response not stored',
        );
      }
    } catch (err) {
      this.logger.warn(`Idempotency response not stored: ${errorMessage(err)}`);
    }
  }

  /**
   * Frees the key of a failed request so a retry runs again. If the store is unreachable, the
   * key frees itself when the in-flight TTL ends.
   */
  private async release(recordKey: string, lease: string): Promise<void> {
    try {
      await this.store.release(recordKey, lease);
    } catch (err) {
      this.logger.warn(`Idempotency key not released after a failed request: ${errorMessage(err)}`);
    }
  }
}

function answerFromRecord(
  record: IdempotencyRecord,
  fingerprint: string,
  response: Response,
): unknown {
  if (record.fingerprint !== fingerprint) {
    throw apiError(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'IDEMPOTENCY_KEY_REUSED',
      'This Idempotency-Key was already used for a request with a different payload. Use a new key for a new request.',
    );
  }
  if (record.status === 'IN_FLIGHT') {
    throw apiError(
      HttpStatus.CONFLICT,
      'IDEMPOTENCY_CONFLICT',
      'A request with this Idempotency-Key is currently in progress. Please retry shortly.',
    );
  }
  response.status(record.response.statusCode);
  response.setHeader('x-idempotent-replay', 'true');
  return record.response.body;
}

/**
 * SHA-256 of the query and body, with object keys sorted, so a repeat counts as the same
 * payload regardless of key order or whitespace. Method and path are part of the record key.
 */
export function requestFingerprint(request: Pick<Request, 'query' | 'body'>): string {
  const payload = JSON.stringify(
    { query: request.query ?? {}, body: request.body ?? null },
    sortKeys,
  );
  return createHash('sha256').update(payload).digest('hex');
}

function sortKeys(_key: string, value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    ),
  );
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
