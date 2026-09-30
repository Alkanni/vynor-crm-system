'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Channel,
  ChannelConnectionInput,
  ChannelTestResult,
  CreateChannelRequest,
  UpdateChannelRequest,
  WorkspaceMember,
} from '@vynor/contracts';
import type { InboxAccount, InboxDraft } from '@/components/channels/types';
import { useApiRequest } from '@/lib/api/use-api-request';

/** Query keys; `channels` is also invalidated by `channel.*` realtime events. */
export const channelKeys = {
  all: ['channels'] as const,
  members: ['workspace-members'] as const,
};

/** Maps the API channel to the inbox view the Channels components render. */
export function toInboxAccount(channel: Channel): InboxAccount {
  const { aiAgentId, distributionMethod, ...settings } = channel.settings;
  return {
    id: channel.id,
    name: channel.name,
    description: channel.description,
    provider: channel.provider,
    identifier: channel.identifier,
    aiAgentId,
    humanAgentIds: channel.humanAgentIds,
    distributionMethod,
    settings,
    needsReconnect: channel.needsReconnect,
    connection: {
      status: channel.status,
      statusReason: channel.statusReason,
      connectedAt: channel.connectedAt,
      lastHealthCheckAt: channel.lastHealthCheckAt,
      inbound: channel.inbound,
      webchat: channel.webchat,
      connectionDetails: channel.connectionDetails,
      secretHints: channel.secretHints,
    },
  };
}

export function toUpdateRequest(draft: InboxDraft): UpdateChannelRequest {
  return {
    name: draft.name,
    description: draft.description,
    humanAgentIds: draft.humanAgentIds,
    settings: {
      aiAgentId: draft.aiAgentId,
      distributionMethod: draft.distributionMethod,
      ...draft.settings,
    },
  };
}

export function useChannels(enabled: boolean) {
  const request = useApiRequest();
  return useQuery({
    queryKey: channelKeys.all,
    queryFn: () => request<Channel[]>('/channels'),
    enabled,
    // Realtime events keep it fresh; polling is the fallback when the socket is down.
    refetchInterval: 30_000,
  });
}

export function useWorkspaceMembers(enabled: boolean) {
  const request = useApiRequest();
  return useQuery({
    queryKey: channelKeys.members,
    queryFn: () => request<WorkspaceMember[]>('/workspace/members'),
    enabled,
    staleTime: 5 * 60_000,
  });
}

function useInvalidateChannels() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: channelKeys.all });
}

export function useCreateChannel() {
  const request = useApiRequest();
  const invalidate = useInvalidateChannels();
  return useMutation({
    mutationFn: (body: CreateChannelRequest) =>
      request<Channel>('/channels', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });
}

export function useUpdateChannel() {
  const request = useApiRequest();
  const invalidate = useInvalidateChannels();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateChannelRequest }) =>
      request<Channel>(`/channels/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });
}

export function useReconnectChannel() {
  const request = useApiRequest();
  const invalidate = useInvalidateChannels();
  return useMutation({
    mutationFn: ({ id, connection }: { id: string; connection: ChannelConnectionInput }) =>
      request<Channel>(`/channels/${id}/credentials`, {
        method: 'PUT',
        body: JSON.stringify({ connection }),
      }),
    onSuccess: invalidate,
  });
}

export function useTestChannel() {
  const request = useApiRequest();
  const invalidate = useInvalidateChannels();
  return useMutation({
    mutationFn: (id: string) =>
      request<ChannelTestResult>(`/channels/${id}/test`, { method: 'POST' }),
    onSettled: invalidate,
  });
}

export function useDeleteChannel() {
  const request = useApiRequest();
  const invalidate = useInvalidateChannels();
  return useMutation({
    mutationFn: (id: string) => request<void>(`/channels/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
