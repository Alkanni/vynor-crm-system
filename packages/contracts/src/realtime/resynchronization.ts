import { z } from 'zod';

export const REALTIME_RESYNC_REASONS = [
  'INITIAL_CONNECTION',
  'RECONNECTED',
  'EVENT_GAP',
  'CLIENT_STALE',
  'SERVER_RESTART',
] as const;

export const RealtimeResyncReasonSchema = z.enum(REALTIME_RESYNC_REASONS);
export type RealtimeResyncReason = z.infer<typeof RealtimeResyncReasonSchema>;

export const REALTIME_RESYNC_RESOURCES = [
  'CONVERSATION_LIST',
  'CONVERSATION_DETAIL',
  'MESSAGES',
  'ASSIGNMENTS',
  'NOTIFICATIONS',
] as const;

export const RealtimeResyncResourceSchema = z.enum(REALTIME_RESYNC_RESOURCES);
export type RealtimeResyncResource = z.infer<typeof RealtimeResyncResourceSchema>;

/**
 * Server instruction that tells clients which authoritative REST resources
 * must be invalidated and fetched again (FND-078).
 */
export const RealtimeResyncInstructionSchema = z.object({
  schemaVersion: z.literal(1),
  reason: RealtimeResyncReasonSchema,
  resources: z.array(RealtimeResyncResourceSchema).min(1),
  serverTime: z.string().datetime(),
  workspaceId: z.string().min(1),
  conversationId: z.string().min(1).optional(),
  lastSeenEventId: z.string().uuid().optional(),
});

export type RealtimeResyncInstruction = z.infer<typeof RealtimeResyncInstructionSchema>;
