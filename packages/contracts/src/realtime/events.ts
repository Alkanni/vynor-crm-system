import { z } from 'zod';
import { RealtimeRoomNameSchema } from './rooms.js';

export const REALTIME_SCHEMA_VERSION = 1 as const;

const RealtimeEventTypeSchema = z
  .string()
  .min(3)
  .max(128)
  .regex(/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9-]*)+$/);

/**
 * Versioned, transport-neutral realtime event envelope (FND-077). Events are
 * hints for clients to update/refetch state, not a durable event log.
 */
export const RealtimeEventEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(REALTIME_SCHEMA_VERSION),
    eventId: z.string().uuid(),
    eventType: RealtimeEventTypeSchema,
    workspaceId: z.string().min(1),
    rooms: z.array(RealtimeRoomNameSchema).min(1),
    occurredAt: z.string().datetime(),
    emittedAt: z.string().datetime(),
    correlationId: z.string().min(1),
    causationId: z.string().min(1).optional(),
    resourceVersion: z.number().int().nonnegative().optional(),
    payload: z.record(z.string(), z.unknown()),
  })
  .superRefine((value, context) => {
    if (new Set(value.rooms).size !== value.rooms.length) {
      context.addIssue({
        code: 'custom',
        path: ['rooms'],
        message: 'Realtime target rooms must be unique',
      });
    }
  });

export type RealtimeEventEnvelope = z.infer<typeof RealtimeEventEnvelopeSchema>;

export interface CreateRealtimeEventInput {
  eventId: string;
  eventType: string;
  workspaceId: string;
  rooms: readonly string[];
  occurredAt: string;
  correlationId: string;
  payload: Record<string, unknown>;
  emittedAt?: string;
  causationId?: string;
  resourceVersion?: number;
}

export function createRealtimeEvent(input: CreateRealtimeEventInput): RealtimeEventEnvelope {
  return RealtimeEventEnvelopeSchema.parse({
    schemaVersion: REALTIME_SCHEMA_VERSION,
    ...input,
    rooms: [...input.rooms],
    emittedAt: input.emittedAt ?? new Date().toISOString(),
  });
}
