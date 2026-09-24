import { z } from 'zod';

export const ActorTypeSchema = z.enum(['USER', 'SYSTEM', 'AI_BOT', 'API_KEY']);
export type ActorType = z.infer<typeof ActorTypeSchema>;

/**
 * Distributed Tracing & Propagation Context (FND-045)
 * Carries correlation, causation, actor, workspace, and W3C trace context
 * across HTTP boundaries, Outbox events, and background jobs.
 */
export const EventContextSchema = z.object({
  /** Root correlation ID originating from HTTP boundary or initial event */
  correlationId: z.string().min(1),
  /** Immediate causation ID that directly triggered this event or job */
  causationId: z.string().optional(),
  /** Workspace ID partition boundary (AD-008) */
  workspaceId: z.string().min(1),
  /** User or system actor who initiated the operation */
  actorId: z.string().optional(),
  /** Type of actor initiating the operation */
  actorType: ActorTypeSchema.optional(),
  /** Standard W3C Trace Context (traceparent: version-trace_id-parent_id-trace_flags) */
  traceparent: z.string().optional(),
});

export type EventContext = z.infer<typeof EventContextSchema>;

/**
 * Standard Outbox Event Envelope (FND-045, AD-006)
 * Enforces metadata envelope around raw event payloads persisted in the outbox_events table.
 */
export const OutboxEventEnvelopeSchema = z.object({
  /** UUIDv7 identifier for time-sortable event streams */
  id: z.string().uuid(),
  /** Workspace ID partition */
  workspaceId: z.string().min(1),
  /** Canonical domain event type (e.g. 'message.created', 'conversation.assigned') */
  eventType: z.string().min(1),
  /** Execution and tracing context */
  context: EventContextSchema,
  /** Serialized domain event payload */
  payload: z.record(z.string(), z.unknown()),
  /** Timestamp when event was scheduled */
  scheduledAt: z.string().datetime(),
  /** Timestamp when event record was written */
  createdAt: z.string().datetime(),
});

export type OutboxEventEnvelope = z.infer<typeof OutboxEventEnvelopeSchema>;

/**
 * Job Context for background workers (pg-boss) (FND-045, AD-002, AD-005)
 */
export const JobContextSchema = z.object({
  jobId: z.string().min(1),
  queueName: z.string().min(1),
  context: EventContextSchema,
  retryCount: z.number().int().nonnegative().default(0),
  enqueuedAt: z.string().datetime(),
});

export type JobContext = z.infer<typeof JobContextSchema>;

/**
 * Helper to construct an EventContext from actor context and HTTP correlation headers.
 */
export function createEventContext(params: {
  correlationId: string;
  workspaceId: string;
  actorId?: string;
  actorType?: ActorType;
  causationId?: string;
  traceparent?: string;
}): EventContext {
  const result: EventContext = {
    correlationId: params.correlationId,
    workspaceId: params.workspaceId,
  };

  if (params.actorId) {
    result.actorId = params.actorId;
  }
  if (params.actorType) {
    result.actorType = params.actorType;
  }
  if (params.causationId) {
    result.causationId = params.causationId;
  }
  if (params.traceparent) {
    result.traceparent = params.traceparent;
  }

  return result;
}
