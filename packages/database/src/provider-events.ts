import {
  Prisma,
  type ChannelType,
  type ProviderEvent,
  type ProviderEventStatus,
} from '@prisma/client';
import type { ReplayProviderEventRequest, ReplayProviderEventResult } from '@vynor/contracts';
import { prisma, type AnyPrismaClient } from './client.js';
import { generateUuidV7 } from './id.js';

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
    lastError?: string;
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
