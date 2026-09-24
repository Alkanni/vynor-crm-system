import { z } from 'zod';
import { ChannelTypeSchema } from './types.js';

/**
 * Processing lifecycle states for raw provider events (FND-067, FND-070).
 */
export const PROVIDER_EVENT_STATUSES = [
  'RECEIVED',
  'PROCESSING',
  'PROCESSED',
  'IGNORED',
  'FAILED',
] as const;

export const ProviderEventStatusSchema = z.enum(PROVIDER_EVENT_STATUSES);
export type ProviderEventStatus = z.infer<typeof ProviderEventStatusSchema>;

/**
 * Immutable ProviderEvent journal schema (FND-067).
 */
export const ProviderEventRecordSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  providerAccountId: z.string(),
  provider: z.string().min(1).max(50),
  channelType: ChannelTypeSchema,
  providerEventKey: z.string().min(1).max(255),
  isFingerprinted: z.boolean(),
  payload: z.record(z.string(), z.unknown()),
  headers: z.record(z.string(), z.string()).optional(),
  status: ProviderEventStatusSchema,
  processingAttempts: z.number().int().nonnegative(),
  lastError: z.string().optional(),
  processedAt: z.string().datetime().optional(),
  retentionDays: z.number().int().positive(),
  purgeAfter: z.string().datetime().optional(),
  correlationId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ProviderEventRecord = z.infer<typeof ProviderEventRecordSchema>;

/**
 * Request payload to replay a journaled provider event (FND-070).
 */
export const ReplayProviderEventRequestSchema = z.object({
  eventId: z.string(),
  reason: z.string().min(1).max(255),
  force: z.boolean().default(false),
});

export type ReplayProviderEventRequest = z.infer<typeof ReplayProviderEventRequestSchema>;

/**
 * Response resulting from a provider event replay operation (FND-070).
 */
export const ReplayProviderEventResultSchema = z.object({
  eventId: z.string(),
  previousStatus: ProviderEventStatusSchema,
  newStatus: ProviderEventStatusSchema,
  replayedAt: z.string().datetime(),
});

export type ReplayProviderEventResult = z.infer<typeof ReplayProviderEventResultSchema>;
