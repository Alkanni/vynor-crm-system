import { io, type Socket } from 'socket.io-client';
import type { QueryClient } from '@tanstack/react-query';
import type {
  RealtimeEventEnvelope,
  RealtimeHandshakeAuth,
  RealtimeResyncInstruction,
  RealtimeResyncResource,
} from '@vynor/contracts';
import { env } from '@/env';

export type RealtimeConnectionStatus =
  'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'auth_error';

export interface RealtimeClientListener {
  onStatusChange?: (status: RealtimeConnectionStatus) => void;
  onAuthError?: (error: { code: string; message: string }) => void;
  onEvent?: (event: RealtimeEventEnvelope) => void;
}

class RealtimeManager {
  private socket: Socket | null = null;
  private status: RealtimeConnectionStatus = 'disconnected';
  private listeners = new Set<RealtimeClientListener>();
  private lastSeenEventId?: string;
  private currentWorkspaceId?: string;
  private queryClient?: QueryClient;

  getStatus(): RealtimeConnectionStatus {
    return this.status;
  }

  addListener(listener: RealtimeClientListener): () => void {
    this.listeners.add(listener);
    listener.onStatusChange?.(this.status);
    return () => this.listeners.delete(listener);
  }

  private setStatus(status: RealtimeConnectionStatus) {
    this.status = status;
    this.listeners.forEach((l) => l.onStatusChange?.(status));
  }

  /**
   * Connects to the authenticated Socket.IO /realtime namespace (FND-FE-007, FND-BE-009).
   */
  connect(accessToken: string, workspaceId: string, queryClient: QueryClient) {
    if (this.socket && this.currentWorkspaceId === workspaceId && this.status === 'connected') {
      return;
    }

    this.disconnect();

    this.currentWorkspaceId = workspaceId;
    this.queryClient = queryClient;
    this.setStatus('connecting');

    const auth: RealtimeHandshakeAuth = {
      accessToken,
      workspaceId,
      clientVersion: 'web/1.0.0',
      ...(this.lastSeenEventId ? { lastSeenEventId: this.lastSeenEventId } : {}),
    };

    const socketUrl = env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

    this.socket = io(`${socketUrl.replace(/\/+$/, '')}/realtime`, {
      auth,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      this.setStatus('connected');
    });

    this.socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        // Server rejected connection (auth failed or workspace revoked)
        this.setStatus('auth_error');
      } else {
        this.setStatus('reconnecting');
      }
    });

    this.socket.on('connect_error', () => {
      this.setStatus('reconnecting');
    });

    this.socket.on('auth:error', (error: { code: string; message: string }) => {
      this.setStatus('auth_error');
      this.listeners.forEach((l) => l.onAuthError?.(error));
    });

    // FND-078 / FND-FE-007: Handle resync instruction
    this.socket.on('resync', (instruction: RealtimeResyncInstruction) => {
      this.handleResync(instruction);
    });

    // Listen to generic domain event types
    this.socket.onAny((eventType: string, envelope: RealtimeEventEnvelope) => {
      if (typeof eventType === 'string' && eventType.includes('.')) {
        if (envelope?.eventId) {
          this.lastSeenEventId = envelope.eventId;
        }
        this.handleDomainEvent(eventType, envelope);
        this.listeners.forEach((l) => l.onEvent?.(envelope));
      }
    });
  }

  /**
   * Invalidates TanStack Query keys based on server-instructed resync resources (FND-FE-007).
   */
  private handleResync(instruction: RealtimeResyncInstruction) {
    if (!this.queryClient) return;

    for (const resource of instruction.resources) {
      this.invalidateResource(resource, instruction.conversationId);
    }
  }

  private invalidateResource(resource: RealtimeResyncResource, conversationId?: string) {
    if (!this.queryClient) return;

    switch (resource) {
      case 'CONVERSATION_LIST':
        void this.queryClient.invalidateQueries({ queryKey: ['conversations'] });
        break;
      case 'CONVERSATION_DETAIL':
        if (conversationId) {
          void this.queryClient.invalidateQueries({
            queryKey: ['conversations', conversationId],
          });
        } else {
          void this.queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
        break;
      case 'MESSAGES':
        if (conversationId) {
          void this.queryClient.invalidateQueries({
            queryKey: ['messages', conversationId],
          });
        }
        break;
      case 'NOTIFICATIONS':
        void this.queryClient.invalidateQueries({ queryKey: ['notifications'] });
        break;
      case 'ASSIGNMENTS':
        void this.queryClient.invalidateQueries({ queryKey: ['assignments'] });
        break;
    }
  }

  /**
   * Translates incoming realtime events into granular TanStack Query invalidations.
   */
  private handleDomainEvent(eventType: string, envelope: RealtimeEventEnvelope) {
    if (!this.queryClient) return;

    if (eventType.startsWith('conversation.')) {
      void this.queryClient.invalidateQueries({ queryKey: ['conversations'] });
      const conversationId = (envelope.payload as { conversationId?: string })?.conversationId;
      if (conversationId) {
        void this.queryClient.invalidateQueries({
          queryKey: ['conversations', conversationId],
        });
        void this.queryClient.invalidateQueries({
          queryKey: ['messages', conversationId],
        });
      }
    }
  }

  joinConversation(conversationId: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket || this.status !== 'connected') {
        resolve(false);
        return;
      }

      this.socket.emit('join:conversation', { conversationId }, (res: { success?: boolean }) => {
        resolve(Boolean(res?.success));
      });
    });
  }

  leaveConversation(conversationId: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket || this.status !== 'connected') {
        resolve(false);
        return;
      }

      this.socket.emit('leave:conversation', { conversationId }, (res: { success?: boolean }) => {
        resolve(Boolean(res?.success));
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.setStatus('disconnected');
  }
}

export const realtimeClient = new RealtimeManager();
