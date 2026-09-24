import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  conversationRoomName,
  hasPermission,
  RealtimeHandshakeAuthSchema,
  workspaceRoomName,
  type RealtimeAuthErrorCode,
  type RealtimeResyncInstruction,
  type RealtimeSocketContext,
} from '@vynor/contracts';
import { createLogger, type Logger } from '@vynor/observability';
import type { Server, Socket } from 'socket.io';
import { ActorContextService } from '../iam/actor-context.service.js';
import { JwtVerifierService } from '../iam/jwt-verifier.service.js';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger: Logger;

  constructor(
    private readonly jwtVerifier: JwtVerifierService,
    private readonly actorContextService: ActorContextService,
  ) {
    this.logger = createLogger({
      service: 'vynor-api',
      environment: process.env.NODE_ENV || 'development',
    });
  }

  getServer(): Server | undefined {
    return this.server;
  }

  /**
   * Realtime Connection Authentication Handshake (FND-BE-009, FND-076).
   * Validates Supabase JWT, resolves workspace membership, enforces room boundaries.
   */
  async handleConnection(socket: Socket): Promise<void> {
    const authParse = RealtimeHandshakeAuthSchema.safeParse(socket.handshake.auth);

    if (!authParse.success) {
      this.rejectConnection(
        socket,
        'TOKEN_MISSING',
        'Invalid or missing handshake authentication.',
      );
      return;
    }

    const { accessToken, workspaceId, lastSeenEventId } = authParse.data;

    let supabaseAuthId: string;
    try {
      const verified = await this.jwtVerifier.verify(accessToken);
      supabaseAuthId = verified.sub;
    } catch {
      this.rejectConnection(socket, 'TOKEN_INVALID', 'Access token is invalid or expired.');
      return;
    }

    try {
      const actor = await this.actorContextService.resolveActorContext(supabaseAuthId, workspaceId);

      const wsRoom = workspaceRoomName(workspaceId);
      const context: RealtimeSocketContext = {
        socketId: socket.id,
        actor,
        authenticatedAt: new Date().toISOString(),
        joinedRooms: [wsRoom],
      };

      socket.data.context = context;

      // Join canonical workspace room
      await socket.join(wsRoom);

      // FND-078: Emit initial resynchronization instruction
      const resyncInstruction: RealtimeResyncInstruction = {
        schemaVersion: 1,
        reason: lastSeenEventId ? 'RECONNECTED' : 'INITIAL_CONNECTION',
        resources: ['CONVERSATION_LIST', 'NOTIFICATIONS'],
        serverTime: new Date().toISOString(),
        workspaceId,
        ...(lastSeenEventId ? { lastSeenEventId } : {}),
      };

      socket.emit('resync', resyncInstruction);

      this.logger.debug(
        {
          socketId: socket.id,
          actorId: actor.user.id,
          workspaceId,
        },
        'Realtime client authenticated and joined workspace room',
      );
    } catch {
      this.rejectConnection(
        socket,
        'WORKSPACE_ACCESS_DENIED',
        'Actor has no active membership in requested workspace.',
      );
    }
  }

  handleDisconnect(socket: Socket): void {
    this.logger.debug({ socketId: socket.id }, 'Realtime client disconnected');
  }

  /**
   * Subscribe to conversation events room (FND-076).
   * Enforces conversation:read permission before joining.
   */
  @SubscribeMessage('join:conversation')
  async handleJoinConversation(
    socket: Socket,
    payload: { conversationId: string },
  ): Promise<{ success: boolean; error?: string }> {
    const context = socket.data?.context as RealtimeSocketContext | undefined;
    if (!context?.actor) {
      return { success: false, error: 'Unauthorized' };
    }

    if (!payload?.conversationId || typeof payload.conversationId !== 'string') {
      return { success: false, error: 'Invalid conversationId' };
    }

    if (!hasPermission(context.actor.permissions, 'conversation:read')) {
      return { success: false, error: 'Forbidden: missing conversation:read permission' };
    }

    try {
      const room = conversationRoomName(payload.conversationId);
      await socket.join(room);

      if (!context.joinedRooms.includes(room)) {
        context.joinedRooms.push(room);
      }

      // Instruct client to resynchronize conversation detail and messages
      const resyncInstruction: RealtimeResyncInstruction = {
        schemaVersion: 1,
        reason: 'INITIAL_CONNECTION',
        resources: ['CONVERSATION_DETAIL', 'MESSAGES'],
        serverTime: new Date().toISOString(),
        workspaceId: context.actor.workspace.id,
        conversationId: payload.conversationId,
      };

      socket.emit('resync', resyncInstruction);

      return { success: true };
    } catch {
      return { success: false, error: 'Failed to join conversation room' };
    }
  }

  /**
   * Unsubscribe from conversation room.
   */
  @SubscribeMessage('leave:conversation')
  async handleLeaveConversation(
    socket: Socket,
    payload: { conversationId: string },
  ): Promise<{ success: boolean }> {
    const context = socket.data?.context as RealtimeSocketContext | undefined;
    if (!context || !payload?.conversationId) {
      return { success: false };
    }

    try {
      const room = conversationRoomName(payload.conversationId);
      await socket.leave(room);

      const idx = context.joinedRooms.indexOf(room);
      if (idx !== -1) {
        context.joinedRooms.splice(idx, 1);
      }

      return { success: true };
    } catch {
      return { success: false };
    }
  }

  private rejectConnection(socket: Socket, code: RealtimeAuthErrorCode, message: string): void {
    socket.emit('auth:error', { code, message, timestamp: new Date().toISOString() });
    socket.disconnect(true);
  }
}
