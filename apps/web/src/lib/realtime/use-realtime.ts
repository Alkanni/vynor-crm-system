'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { realtimeClient, type RealtimeConnectionStatus } from '@/lib/realtime/realtime-client';

export function useRealtime() {
  const { accessToken, actor } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeConnectionStatus>(() => realtimeClient.getStatus());

  useEffect(() => {
    const unsubscribe = realtimeClient.addListener({
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
      },
      onAuthError: (err) => {
        console.warn('[Realtime Auth Error]', err);
      },
    });

    if (accessToken && actor?.workspace.id) {
      realtimeClient.connect(accessToken, actor.workspace.id, queryClient);
    } else {
      realtimeClient.disconnect();
    }

    return () => {
      unsubscribe();
    };
  }, [accessToken, actor?.workspace.id, queryClient]);

  const joinConversation = useCallback((conversationId: string) => {
    return realtimeClient.joinConversation(conversationId);
  }, []);

  const leaveConversation = useCallback((conversationId: string) => {
    return realtimeClient.leaveConversation(conversationId);
  }, []);

  return {
    status,
    isConnected: status === 'connected',
    joinConversation,
    leaveConversation,
  };
}
