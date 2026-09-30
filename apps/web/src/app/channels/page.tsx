'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { CircleAlert, Info, Plus, Radio } from 'lucide-react';
import type { ChannelProviderType } from '@vynor/contracts';
import { ConnectPlatformModal } from '@/components/channels/ConnectPlatformModal';
import { InboxList } from '@/components/channels/InboxList';
import { InboxSettingsPanel } from '@/components/channels/InboxSettingsPanel';
import { useAiAgents } from '@/lib/ai-agents/queries';
import { useAuth, usePermission } from '@/lib/auth/auth-context';
import { useLiveChannelSource, usePreviewChannelSource } from '@/lib/channels/use-channel-source';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageLayout } from '@/components/layout/PageLayout';
import { Banner, Button, useToast } from '@/components/ui';
import type {
  ConnectionCredentials,
  InboxAccount,
  InboxAgent,
  InboxDraft,
} from '@/components/channels/types';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function ChannelsPage() {
  const { mode } = useAuth();
  const canManage = usePermission('integration:manage');
  const live = useLiveChannelSource(mode === 'connected');
  const preview = usePreviewChannelSource();
  const source = mode === 'connected' ? live : preview;
  const { inboxes } = source;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [reconnectId, setReconnectId] = useState<string | null>(null);
  const toast = useToast();
  const agentsQuery = useAiAgents();
  // Agents are created and configured on the AI Agent page.
  const aiAgents = useMemo<InboxAgent[]>(
    () => (agentsQuery.data ?? []).map(({ id, name }) => ({ id, name })),
    [agentsQuery.data],
  );

  const selected = inboxes.find((inbox) => inbox.id === selectedId) ?? inboxes[0] ?? null;
  const reconnectInbox = inboxes.find((inbox) => inbox.id === reconnectId);

  const showToast = (msg: string) => toast.show(msg, 'success');
  const showError = (msg: string) => toast.show(msg, 'error');

  const openConnect = () => setConnectOpen(true);
  const closeConnect = useCallback(() => setConnectOpen(false), []);
  const closeReconnect = useCallback(() => setReconnectId(null), []);

  const handleSave = async (id: string, draft: InboxDraft) => {
    try {
      await source.save(id, draft);
      showToast(`${draft.name} saved.`);
    } catch (error) {
      showError(errorMessage(error, 'Could not save the inbox. Try again.'));
    }
  };

  const handleDelete = async (id: string) => {
    const removed = inboxes.find((inbox) => inbox.id === id);
    try {
      await source.remove(id);
      setSelectedId(inboxes.find((inbox) => inbox.id !== id)?.id ?? null);
      if (removed) showToast(`${removed.name} deleted.`);
    } catch (error) {
      showError(errorMessage(error, 'Could not delete the inbox. Try again.'));
    }
  };

  const handleReconnect = (id: string) => {
    if (source.mode === 'preview') {
      void source
        .reconnect(id, null)
        .then(() => showToast('Reconnected. New messages will arrive in this inbox again.'));
      return;
    }
    // Real inboxes need fresh credentials, verified by the platform.
    setReconnectId(id);
  };

  const handleReconnectSubmit = async (inbox: InboxAccount, credentials: ConnectionCredentials) => {
    const updated = await source.reconnect(inbox.id, credentials);
    showToast(`${updated.name} reconnected. New messages will arrive in this inbox again.`);
    return updated;
  };

  const handleConnect = async (
    provider: ChannelProviderType,
    name: string,
    credentials: ConnectionCredentials | null,
  ) => {
    const inbox = await source.connect(provider, name, credentials);
    setSelectedId(inbox.id);
    if (source.mode === 'preview') {
      setConnectOpen(false);
      showToast(`${name} connected. Add agents to start answering chats.`);
    }
    return inbox;
  };

  const handleTestConnection = async (id: string) => {
    const result = await source.test(id);
    return result;
  };

  return (
    <PageLayout
      title="Channels"
      description="This is where you can connect all your platforms"
      width="wide"
      actions={
        canManage ? (
          <Button size="sm" icon={Plus} label="Connect a platform" onClick={openConnect} />
        ) : undefined
      }
    >
      {source.mode === 'preview' && (
        <Banner color="amber" icon={<Info className="size-4" />} className="mb-5">
          Preview mode: these inboxes are sample data and nothing is sent to the platforms. Sign in
          to a workspace with the VYNOR API running to connect real accounts.
        </Banner>
      )}

      {source.isLoading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : source.error ? (
        <EmptyState
          compact
          icon={<CircleAlert className="size-5" />}
          title="Channels could not be loaded"
          description={errorMessage(source.error, 'The VYNOR API did not respond.')}
          action={{ label: 'Try again', onClick: source.retry }}
          className="border border-dashed border-n-strong"
        />
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex min-h-0 flex-col lg:sticky lg:top-0 lg:w-[380px] lg:shrink-0">
            <InboxList
              inboxes={inboxes}
              selectedId={selected?.id ?? null}
              aiAgents={aiAgents}
              humanAgents={source.humanAgents}
              onSelect={setSelectedId}
              onConnect={openConnect}
            />
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {selected ? (
              <InboxSettingsPanel
                key={selected.id}
                inbox={selected}
                aiAgents={aiAgents}
                humanAgents={source.humanAgents}
                canManage={canManage}
                onSave={handleSave}
                onDelete={handleDelete}
                onReconnect={handleReconnect}
                onTestConnection={source.mode === 'connected' ? handleTestConnection : undefined}
              />
            ) : (
              <EmptyState
                compact
                icon={<Radio className="size-5" />}
                title="No channels yet"
                description="Connect WhatsApp, Instagram, email or another platform to start receiving customer messages here."
                action={
                  canManage ? { label: 'Connect a platform', onClick: openConnect } : undefined
                }
                className="border border-dashed border-n-strong"
              />
            )}
          </div>
        </div>
      )}

      {connectOpen && (
        <ConnectPlatformModal
          collectCredentials={source.mode === 'connected'}
          onClose={closeConnect}
          onConnect={handleConnect}
        />
      )}
      {reconnectInbox && (
        <ConnectPlatformModal
          collectCredentials
          reconnectInbox={reconnectInbox}
          onClose={closeReconnect}
          onConnect={handleConnect}
          onReconnect={handleReconnectSubmit}
        />
      )}
      {toast.element}
    </PageLayout>
  );
}
