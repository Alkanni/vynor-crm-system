import { z } from 'zod';

const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export const WorkspaceRoomNameSchema = z.string().regex(/^workspace:[A-Za-z0-9_-]+$/);
export const ConversationRoomNameSchema = z.string().regex(/^conversation:[A-Za-z0-9_-]+$/);
export const RealtimeRoomNameSchema = z.union([
  WorkspaceRoomNameSchema,
  ConversationRoomNameSchema,
]);

export type RealtimeRoomName = z.infer<typeof RealtimeRoomNameSchema>;

function assertRoomId(id: string): void {
  if (!ROOM_ID_PATTERN.test(id)) {
    throw new Error(
      'Realtime room IDs may only contain letters, numbers, underscores, and hyphens',
    );
  }
}

export function workspaceRoomName(workspaceId: string): `workspace:${string}` {
  assertRoomId(workspaceId);
  return `workspace:${workspaceId}`;
}

export function conversationRoomName(conversationId: string): `conversation:${string}` {
  assertRoomId(conversationId);
  return `conversation:${conversationId}`;
}
