'use client';

import { useMemo, useState } from 'react';
import {
  ChannelConnectionInputSchema,
  type ChannelConnectionInput,
  type ChannelProviderType,
} from '@vynor/contracts';
import type {
  ConnectionCredentials,
  InboxAccount,
  InboxAgent,
  InboxDraft,
} from '@/components/channels/types';
import { PREVIEW_HUMAN_AGENTS, PREVIEW_INBOXES, PREVIEW_INBOX_SETTINGS } from './preview-data';
import {
  toInboxAccount,
  toUpdateRequest,
  useChannels,
  useCreateChannel,
  useDeleteChannel,
  useReconnectChannel,
  useTestChannel,
  useUpdateChannel,
  useWorkspaceMembers,
} from './queries';

export interface ChannelTestOutcome {
  ok: boolean;
  message: string;
}

/**
 * What the Channels page needs, independent of where inboxes live: the API (connected mode)
 * or in-memory sample data (preview mode).
 */
export interface ChannelSource {
  mode: 'connected' | 'preview';
  inboxes: InboxAccount[];
  humanAgents: InboxAgent[];
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
  connect: (
    provider: ChannelProviderType,
    name: string,
    credentials: ConnectionCredentials | null,
  ) => Promise<InboxAccount>;
  reconnect: (id: string, credentials: ConnectionCredentials | null) => Promise<InboxAccount>;
  save: (id: string, draft: InboxDraft) => Promise<void>;
  remove: (id: string) => Promise<void>;
  test: (id: string) => Promise<ChannelTestOutcome>;
}

function toConnection(
  provider: ChannelProviderType,
  credentials: ConnectionCredentials | null,
): ChannelConnectionInput {
  // The dialog validated this already; parsing again keeps the request type-safe.
  return ChannelConnectionInputSchema.parse({ provider, credentials: credentials ?? {} });
}

export function useLiveChannelSource(enabled: boolean): ChannelSource {
  const channels = useChannels(enabled);
  const members = useWorkspaceMembers(enabled);
  const create = useCreateChannel();
  const update = useUpdateChannel();
  const reconnect = useReconnectChannel();
  const test = useTestChannel();
  const remove = useDeleteChannel();

  const inboxes = useMemo(() => (channels.data ?? []).map(toInboxAccount), [channels.data]);
  const humanAgents = useMemo<InboxAgent[]>(
    () => (members.data ?? []).map((m) => ({ id: m.membershipId, name: m.displayName })),
    [members.data],
  );

  return {
    mode: 'connected',
    inboxes,
    humanAgents,
    isLoading: enabled && channels.isLoading,
    error: channels.error,
    retry: () => void channels.refetch(),
    connect: async (provider, name, credentials) =>
      toInboxAccount(
        await create.mutateAsync({ name, connection: toConnection(provider, credentials) }),
      ),
    reconnect: async (id, credentials) => {
      const inbox = inboxes.find((i) => i.id === id);
      if (!inbox) throw new Error('This inbox no longer exists.');
      return toInboxAccount(
        await reconnect.mutateAsync({ id, connection: toConnection(inbox.provider, credentials) }),
      );
    },
    save: async (id, draft) => {
      await update.mutateAsync({ id, body: toUpdateRequest(draft) });
    },
    remove: async (id) => {
      await remove.mutateAsync(id);
    },
    test: async (id) => {
      const result = await test.mutateAsync(id);
      return { ok: result.ok, message: result.message };
    },
  };
}

/** Sample inboxes kept in memory, for the UI demo without an API. */
export function usePreviewChannelSource(): ChannelSource {
  const [inboxes, setInboxes] = useState<InboxAccount[]>(PREVIEW_INBOXES);

  return {
    mode: 'preview',
    inboxes,
    humanAgents: PREVIEW_HUMAN_AGENTS,
    isLoading: false,
    error: null,
    retry: () => undefined,
    connect: async (provider, name) => {
      const inbox: InboxAccount = {
        id: `chan_${Date.now()}`,
        name,
        description: '',
        provider,
        identifier: '',
        aiAgentId: null,
        humanAgentIds: [],
        distributionMethod: 'LEAST_ASSIGNED',
        settings: PREVIEW_INBOX_SETTINGS,
        needsReconnect: false,
      };
      setInboxes((prev) => [...prev, inbox]);
      return inbox;
    },
    reconnect: async (id) => {
      const current = inboxes.find((inbox) => inbox.id === id);
      if (!current) throw new Error('This inbox no longer exists.');
      const updated = { ...current, needsReconnect: false };
      setInboxes((prev) => prev.map((inbox) => (inbox.id === id ? updated : inbox)));
      return updated;
    },
    save: async (id, draft) => {
      setInboxes((prev) => prev.map((inbox) => (inbox.id === id ? { ...inbox, ...draft } : inbox)));
    },
    remove: async (id) => {
      setInboxes((prev) => prev.filter((inbox) => inbox.id !== id));
    },
    test: async () => ({ ok: true, message: 'Preview mode: no real connection to test.' }),
  };
}
