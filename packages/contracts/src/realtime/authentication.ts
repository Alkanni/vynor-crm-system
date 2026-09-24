import { z } from 'zod';
import { ActorContextSchema } from '../iam/actor.js';
import { RealtimeRoomNameSchema } from './rooms.js';

/**
 * Socket.IO handshake authentication supplied by a client. Only the access
 * token and requested workspace are accepted; actor identity and permissions
 * are always resolved by the server (FND-076).
 */
export const RealtimeHandshakeAuthSchema = z.object({
  accessToken: z.string().min(1),
  workspaceId: z.string().min(1),
  clientVersion: z.string().min(1).max(64).optional(),
  lastSeenEventId: z.string().uuid().optional(),
});

export type RealtimeHandshakeAuth = z.infer<typeof RealtimeHandshakeAuthSchema>;

/** Server-owned socket context. The access token must never be copied here. */
export const RealtimeSocketContextSchema = z.object({
  socketId: z.string().min(1),
  actor: ActorContextSchema,
  authenticatedAt: z.string().datetime(),
  joinedRooms: z.array(RealtimeRoomNameSchema),
});

export type RealtimeSocketContext = z.infer<typeof RealtimeSocketContextSchema>;

export const REALTIME_AUTH_ERROR_CODES = [
  'TOKEN_MISSING',
  'TOKEN_INVALID',
  'TOKEN_EXPIRED',
  'MEMBERSHIP_INACTIVE',
  'WORKSPACE_ACCESS_DENIED',
  'ROOM_ACCESS_DENIED',
] as const;

export const RealtimeAuthErrorCodeSchema = z.enum(REALTIME_AUTH_ERROR_CODES);
export type RealtimeAuthErrorCode = z.infer<typeof RealtimeAuthErrorCodeSchema>;
