import type { OutboxEvent, Prisma, PrismaClient } from '@prisma/client';
import type { AnyPrismaClient } from './client.js';
import { generateUuidV7 } from './id.js';
import { withTransaction, type TransactionOptions } from './transaction.js';

export interface CreateOutboxEventParams {
  workspaceId: string;
  eventType: string;
  payload: Record<string, unknown>;
  correlationId: string;
  causationId?: string;
  actorId?: string;
  traceparent?: string;
  scheduledAt?: Date;
}

export interface TransactionalOutboxResult<T> {
  result: T;
  outboxEvents: OutboxEvent[];
}

/**
 * Persists an OutboxEvent within an ongoing Prisma transaction or client (FND-056, FND-057, AD-006).
 * Guarantees zero orphan outbox rows if transaction rolls back.
 */
export async function createOutboxEvent(
  tx: AnyPrismaClient,
  params: CreateOutboxEventParams,
): Promise<OutboxEvent> {
  const id = generateUuidV7();

  return tx.outboxEvent.create({
    data: {
      id,
      workspaceId: params.workspaceId,
      eventType: params.eventType,
      payload: params.payload as Prisma.InputJsonValue,
      correlationId: params.correlationId,
      ...(params.causationId ? { causationId: params.causationId } : {}),
      ...(params.actorId ? { actorId: params.actorId } : {}),
      ...(params.traceparent ? { traceparent: params.traceparent } : {}),
      scheduledAt: params.scheduledAt || new Date(),
    },
  });
}

/**
 * Atomic domain mutation helper that persists outbox events alongside domain changes (FND-057, AD-006).
 */
export async function withTransactionalOutbox<T>(
  client: PrismaClient,
  operation: (
    tx: Prisma.TransactionClient,
  ) => Promise<{ result: T; outbox: CreateOutboxEventParams[] }>,
  options?: TransactionOptions,
): Promise<TransactionalOutboxResult<T>> {
  return withTransaction(
    client,
    async (tx: Prisma.TransactionClient) => {
      const { result, outbox } = await operation(tx);
      const persistedOutbox: OutboxEvent[] = [];

      for (const event of outbox) {
        const record = await createOutboxEvent(tx, event);
        persistedOutbox.push(record);
      }

      return {
        result,
        outboxEvents: persistedOutbox,
      };
    },
    options,
  );
}

/**
 * Safe concurrent outbox claiming query helper (FND-058, AD-006).
 * Claims up to `limit` pending outbox events using PostgreSQL's SELECT FOR UPDATE SKIP LOCKED.
 */
export async function claimPendingOutboxEvents(
  client: AnyPrismaClient,
  workerId: string,
  limit = 50,
  leaseDurationSeconds = 60,
): Promise<OutboxEvent[]> {
  const claimed = await client.$queryRaw<OutboxEvent[]>`
    UPDATE outbox_events
    SET status = 'PROCESSING',
        claimed_by = ${workerId},
        claimed_at = NOW(),
        claim_lease_expires_at = NOW() + (${leaseDurationSeconds} * INTERVAL '1 second'),
        updated_at = NOW()
    WHERE id IN (
      SELECT id FROM outbox_events
      WHERE status = 'PENDING'
        AND scheduled_at <= NOW()
      ORDER BY scheduled_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
  `;

  return claimed;
}

/**
 * Lease recovery helper (FND-058, FND-060).
 * Reclaims expired leases from dead/stuck workers and resets them to PENDING.
 */
export async function recoverExpiredOutboxLeases(
  client: AnyPrismaClient,
  maxRetries = 5,
): Promise<{ recoveredCount: number; deadLetterCount: number }> {
  // 1. Recover expired leases within retry limits
  const recovered = await client.$queryRaw<{ id: string }[]>`
    UPDATE outbox_events
    SET status = 'PENDING',
        claimed_by = NULL,
        claimed_at = NULL,
        claim_lease_expires_at = NULL,
        retry_count = retry_count + 1,
        last_error = 'Lease expired without completion (worker recovery)',
        updated_at = NOW()
    WHERE status = 'PROCESSING'
      AND claim_lease_expires_at < NOW()
      AND retry_count < ${maxRetries}
    RETURNING id;
  `;

  // 2. Transition events that exceeded maxRetries to DEAD_LETTER
  const deadLetter = await client.$queryRaw<{ id: string }[]>`
    UPDATE outbox_events
    SET status = 'DEAD_LETTER',
        claimed_by = NULL,
        claim_lease_expires_at = NULL,
        last_error = 'Exceeded maximum retries upon lease expiration',
        updated_at = NOW()
    WHERE status = 'PROCESSING'
      AND claim_lease_expires_at < NOW()
      AND retry_count >= ${maxRetries}
    RETURNING id;
  `;

  return {
    recoveredCount: recovered.length,
    deadLetterCount: deadLetter.length,
  };
}
