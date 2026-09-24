import { z } from 'zod';
import { EventContextSchema, type EventContext } from '../observability/events.js';
import { QueueNameSchema } from './queues.js';

/**
 * Standard Versioned Background Job Envelope (FND-052, AD-002, AD-013)
 * Guarantees that every background job carries immutable trace context,
 * execution attempt counters, and payload version metadata.
 */
export const JobEnvelopeSchema = z.object({
  /** Unique Job ID (UUIDv7 or pg-boss ID) */
  jobId: z.string().min(1),
  /** Target named queue */
  queue: QueueNameSchema,
  /** Schema version of the payload (enables forward-compatible migrations) */
  version: z.number().int().positive().default(1),
  /** Distributed tracing and tenant context (FND-045) */
  context: EventContextSchema,
  /** Current attempt sequence number (1-indexed) */
  attempt: z.number().int().positive().default(1),
  /** Maximum retry attempts allocated before routing to DLQ */
  maxAttempts: z.number().int().positive().default(5),
  /** ISO 8601 timestamp when job was enqueued */
  enqueuedAt: z.string().datetime(),
  /** Serialized domain payload */
  payload: z.record(z.string(), z.unknown()),
});

export type JobEnvelope<T = Record<string, unknown>> = Omit<
  z.infer<typeof JobEnvelopeSchema>,
  'payload'
> & {
  payload: T;
};

/**
 * Helper to construct a typed, validated JobEnvelope.
 */
export function createJobEnvelope<T extends Record<string, unknown>>(params: {
  jobId: string;
  queue: z.infer<typeof QueueNameSchema>;
  context: EventContext;
  payload: T;
  version?: number;
  attempt?: number;
  maxAttempts?: number;
}): JobEnvelope<T> {
  return {
    jobId: params.jobId,
    queue: params.queue,
    version: params.version ?? 1,
    context: params.context,
    attempt: params.attempt ?? 1,
    maxAttempts: params.maxAttempts ?? 5,
    enqueuedAt: new Date().toISOString(),
    payload: params.payload,
  };
}
