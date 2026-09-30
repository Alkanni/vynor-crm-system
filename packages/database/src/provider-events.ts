import {
  Prisma,
  type ChannelType,
  type PrismaClient,
  type ProviderEvent,
  type ProviderEventStatus,
} from '@prisma/client';
import type { ReplayProviderEventRequest, ReplayProviderEventResult } from '@vynor/contracts';
import { prisma, type AnyPrismaClient } from './client.js';
import { generateUuidV7 } from './id.js';
import { createOutboxEvent } from './outbox.js';

export interface PersistProviderEventParams {
  workspaceId: string;
  providerAccountId: string;
  provider: string;
  channelType: ChannelType;
  providerEventKey: string;
  isFingerprinted: boolean;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
  correlationId?: string;
  retentionDays?: number;
}

export interface PersistProviderEventResult {
  isDuplicate: boolean;
  event: ProviderEvent;
}

/**
 * Persists an immutable raw provider event into the journal (FND-067, AD-004).
 * Enforces deduplication via unique constraint on (providerAccountId, providerEventKey) (FND-069).
 * If a duplicate event arrives (at-least-once delivery), returns { isDuplicate: true } with the existing record.
 */
export async function persistProviderEvent(
  params: PersistProviderEventParams,
  client: AnyPrismaClient = prisma,
): Promise<PersistProviderEventResult> {
  const id = generateUuidV7();
  const retentionDays = params.retentionDays ?? 90;
  const purgeAfter = new Date();
  purgeAfter.setDate(purgeAfter.getDate() + retentionDays);

  try {
    const event = await client.providerEvent.create({
      data: {
        id,
        workspaceId: params.workspaceId,
        providerAccountId: params.providerAccountId,
        provider: params.provider,
        channelType: params.channelType,
        providerEventKey: params.providerEventKey,
        isFingerprinted: params.isFingerprinted,
        payload: params.payload as Prisma.InputJsonValue,
        ...(params.headers ? { headers: params.headers as Prisma.InputJsonValue } : {}),
        status: 'RECEIVED',
        processingAttempts: 0,
        retentionDays,
        purgeAfter,
        ...(params.correlationId ? { correlationId: params.correlationId } : {}),
      },
    });

    return {
      isDuplicate: false,
      event,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      // Duplicate delivery detected (FND-069, AD-005)
      const existing = await client.providerEvent.findUnique({
        where: {
          providerAccountId_providerEventKey: {
            providerAccountId: params.providerAccountId,
            providerEventKey: params.providerEventKey,
          },
        },
      });

      if (existing) {
        return {
          isDuplicate: true,
          event: existing,
        };
      }
    }

    throw error;
  }
}

/**
 * Transitions the processing state of a provider event (FND-070).
 */
export async function transitionProviderEventStatus(
  eventId: string,
  newStatus: ProviderEventStatus,
  options?: {
    /** New error text, or null to clear it. */
    lastError?: string | null;
    incrementAttempts?: boolean;
  },
  client: AnyPrismaClient = prisma,
): Promise<ProviderEvent> {
  return client.providerEvent.update({
    where: { id: eventId },
    data: {
      status: newStatus,
      ...(newStatus === 'PROCESSED' ? { processedAt: new Date() } : {}),
      ...(options?.lastError !== undefined ? { lastError: options.lastError } : {}),
      ...(options?.incrementAttempts ? { processingAttempts: { increment: 1 } } : {}),
    },
  });
}

/**
 * Replays a journaled provider event by resetting its state to RECEIVED (FND-070).
 */
export async function replayProviderEvent(
  request: ReplayProviderEventRequest,
  client: AnyPrismaClient = prisma,
): Promise<ReplayProviderEventResult> {
  const existing = await client.providerEvent.findUniqueOrThrow({
    where: { id: request.eventId },
  });

  const updated = await client.providerEvent.update({
    where: { id: request.eventId },
    data: {
      status: 'RECEIVED',
      lastError: null,
      updatedAt: new Date(),
    },
  });

  return {
    eventId: updated.id,
    previousStatus: existing.status,
    newStatus: updated.status,
    replayedAt: new Date().toISOString(),
  };
}

export interface JournalEventInput {
  providerEventKey: string;
  isFingerprinted: boolean;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface JournalProviderEventsParams {
  workspaceId: string;
  providerAccountId: string;
  provider: string;
  channelType: ChannelType;
  events: JournalEventInput[];
  correlationId: string;
  retentionDays?: number;
}

export interface JournalProviderEventsResult {
  /** IDs of newly journaled events (each has an outbox row queued for processing). */
  acceptedEventIds: string[];
  /** Events skipped because the same key was already journaled (provider retry). */
  duplicateCount: number;
}

/** Outbox event type that queues a journaled provider event for normalization. */
export const PROVIDER_EVENT_RECEIVED = 'webhook.received';

/**
 * Journals a batch of provider events and queues each new one for processing, in a single
 * transaction (FND-067, FND-069, AD-004, AD-006). Uses INSERT … ON CONFLICT DO NOTHING so a
 * redelivered event is skipped without aborting the transaction.
 */
export async function journalProviderEvents(
  client: PrismaClient,
  params: JournalProviderEventsParams,
): Promise<JournalProviderEventsResult> {
  if (params.events.length === 0) return { acceptedEventIds: [], duplicateCount: 0 };
  return client.$transaction((tx) => journalProviderEventsInTransaction(tx, params));
}

/** Same as `journalProviderEvents`, inside a transaction the caller already holds. */
export async function journalProviderEventsInTransaction(
  tx: Prisma.TransactionClient,
  params: JournalProviderEventsParams,
): Promise<JournalProviderEventsResult> {
  if (params.events.length === 0) return { acceptedEventIds: [], duplicateCount: 0 };

  const retentionDays = params.retentionDays ?? 90;
  const purgeAfter = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
  // Deduplicate within the batch too (a provider can repeat an event in one delivery).
  const unique = [...new Map(params.events.map((e) => [e.providerEventKey, e])).values()];

  const created = await tx.providerEvent.createManyAndReturn({
    data: unique.map((event) => ({
      id: generateUuidV7(),
      workspaceId: params.workspaceId,
      providerAccountId: params.providerAccountId,
      provider: params.provider,
      channelType: params.channelType,
      providerEventKey: event.providerEventKey,
      isFingerprinted: event.isFingerprinted,
      payload: event.payload as Prisma.InputJsonValue,
      ...(event.headers ? { headers: event.headers as Prisma.InputJsonValue } : {}),
      status: 'RECEIVED' as const,
      retentionDays,
      purgeAfter,
      correlationId: params.correlationId,
    })),
    skipDuplicates: true,
    select: { id: true },
  });

  for (const event of created) {
    await createOutboxEvent(tx, {
      workspaceId: params.workspaceId,
      eventType: PROVIDER_EVENT_RECEIVED,
      payload: { providerEventId: event.id },
      correlationId: params.correlationId,
    });
  }

  return {
    acceptedEventIds: created.map((event) => event.id),
    duplicateCount: params.events.length - created.length,
  };
}
