'use client';

import React, { useState } from 'react';
import { Trash2, TriangleAlert, X } from 'lucide-react';
import type {
  ChatDistributionMethod,
  InboxAccount,
  InboxAgent,
  InboxDraft,
  InboxSettings,
} from './types';
import { PlatformIcon, getPlatform } from './platforms';
import { FIELD_CLASS, SelectField, Toggle } from '@/components/common/form-controls';
import { Avatar, Banner, Button, Dialog } from '@/components/ui';
import { cn } from '@/lib/utils';

const DISTRIBUTION_METHODS: { value: ChatDistributionMethod; label: string }[] = [
  { value: 'LEAST_ASSIGNED', label: 'Least Assigned First' },
  { value: 'ROUND_ROBIN', label: 'Round Robin' },
  { value: 'MANUAL', label: 'Manual Assignment' },
];

const SETTING_ROWS: {
  key: Exclude<keyof InboxSettings, 'maxConversationsPerAgent'>;
  title: string;
  description: string;
}[] = [
  {
    key: 'maxConversationsEnabled',
    title: 'Maximum conversation per agent',
    description:
      'Limit how many active conversations each agent can receive from auto-assignment in this inbox.',
  },
  {
    key: 'preferredAgent',
    title: 'Preferred Agent',
    description: 'Route returning customers to the last agent who handled the conversation.',
  },
  {
    key: 'csatEnabled',
    title: 'Customer Satisfaction (CSAT)',
    description: 'Send a review link to the chat after it is resolved by an agent.',
  },
  {
    key: 'reassignWhenOffline',
    title: 'Reassign Chat When Agent is Offline',
    description:
      'Automatically reassign conversations to an available agent when the assigned agent goes offline.',
  },
];

function toDraft(inbox: InboxAccount): InboxDraft {
  return {
    name: inbox.name,
    description: inbox.description,
    aiAgentId: inbox.aiAgentId,
    humanAgentIds: inbox.humanAgentIds,
    distributionMethod: inbox.distributionMethod,
    settings: inbox.settings,
  };
}

interface InboxSettingsPanelProps {
  inbox: InboxAccount;
  aiAgents: InboxAgent[];
  humanAgents: InboxAgent[];
  onSave: (id: string, draft: InboxDraft) => void;
  onDelete: (id: string) => void;
  onReconnect: (id: string) => void;
}

/**
 * Settings for the selected inbox. The parent remounts it with `key={inbox.id}`
 * so the draft always starts from the inbox being shown.
 */
export function InboxSettingsPanel({
  inbox,
  aiAgents,
  humanAgents,
  onSave,
  onDelete,
  onReconnect,
}: InboxSettingsPanelProps) {
  const [draft, setDraft] = useState<InboxDraft>(() => toDraft(inbox));
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Raw text so the limit field can be cleared while typing a new number.
  const [limitInput, setLimitInput] = useState(String(inbox.settings.maxConversationsPerAgent));

  const isDirty = JSON.stringify(draft) !== JSON.stringify(toDraft(inbox));
  const canSave = isDirty && draft.name.trim().length > 0;
  const platform = getPlatform(inbox.provider);
  const assigned = humanAgents.filter((a) => draft.humanAgentIds.includes(a.id));
  const unassigned = humanAgents.filter((a) => !draft.humanAgentIds.includes(a.id));

  const update = <K extends keyof InboxDraft>(key: K, value: InboxDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));
  const updateSetting = <K extends keyof InboxSettings>(key: K, value: InboxSettings[K]) =>
    setDraft((prev) => ({ ...prev, settings: { ...prev.settings, [key]: value } }));

  return (
    <section
      className="flex min-h-0 flex-1 flex-col rounded-xl bg-n-solid-2 outline outline-1 -outline-offset-1 outline-n-container"
      aria-label={`${inbox.name} settings`}
    >
      {/* Actions */}
      <div className="flex items-center justify-end gap-2 border-b border-n-weak px-4 py-3 sm:px-6">
        <Button
          size="sm"
          label="Save"
          disabled={!canSave}
          onClick={() => onSave(inbox.id, { ...draft, name: draft.name.trim() })}
        />
        <Button
          size="sm"
          variant="faded"
          color="ruby"
          icon={Trash2}
          onClick={() => setConfirmDelete(true)}
          aria-label="Delete inbox"
          title="Delete inbox"
        />
      </div>

      <div className="flex min-h-0 flex-col gap-7 px-4 py-6 sm:px-6">
        {/* Identity */}
        <div className="flex flex-col items-center gap-1 text-center">
          <PlatformIcon provider={inbox.provider} className="mb-2" />
          <input
            value={draft.name}
            onChange={(e) => update('name', e.target.value)}
            aria-label="Inbox name"
            placeholder="Inbox name"
            className="w-full rounded-md bg-transparent px-2 py-1 text-center text-lg font-semibold text-n-slate-12 outline-none placeholder:text-n-slate-11 hover:bg-n-slate-3 focus:bg-n-slate-3"
          />
          <input
            value={draft.description}
            onChange={(e) => update('description', e.target.value)}
            aria-label="Inbox description"
            placeholder="Type a description here..."
            className="w-full rounded-md bg-transparent px-2 py-1 text-center text-sm text-n-slate-12 outline-none placeholder:text-n-slate-11 hover:bg-n-slate-3 focus:bg-n-slate-3"
          />
          <p className="text-xs text-n-slate-10">
            {platform.label}
            {inbox.identifier && ` · ${inbox.identifier}`}
          </p>
        </div>

        {inbox.needsReconnect && (
          <Banner
            role="alert"
            color="ruby"
            icon={<TriangleAlert className="size-4" />}
            actionLabel="Reconnect"
            onAction={() => onReconnect(inbox.id)}
          >
            This inbox is disconnected. Reconnect it to keep receiving messages.
          </Banner>
        )}

        {/* AI Agent */}
        <div className="flex flex-col gap-2">
          <label htmlFor="inbox-ai-agent" className="text-sm font-medium text-n-slate-12">
            AI Agent
          </label>
          <SelectField
            id="inbox-ai-agent"
            // A deleted agent reads as "No AI agent" instead of an unknown id.
            value={aiAgents.some((a) => a.id === draft.aiAgentId) ? (draft.aiAgentId ?? '') : ''}
            onChange={(e) => update('aiAgentId', e.target.value || null)}
          >
            <option value="">No AI agent</option>
            {aiAgents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </SelectField>
        </div>

        {/* Human Agents */}
        <div className="flex flex-col gap-2">
          <span id="inbox-human-agents" className="text-sm font-medium text-n-slate-12">
            Human Agent
          </span>
          <div
            className="flex min-h-12 flex-wrap items-center gap-2 rounded-lg bg-n-alpha-black2 px-3 py-2 outline outline-1 -outline-offset-1 outline-n-weak"
            aria-labelledby="inbox-human-agents"
          >
            {assigned.map((agent) => (
              <span
                key={agent.id}
                className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-n-label-color py-1 pl-1 pr-1.5 text-sm text-n-slate-12 outline outline-1 -outline-offset-1 outline-n-label-border"
              >
                <Avatar name={agent.name} size={20} roundedFull />
                <span className="max-w-[140px] truncate">{agent.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    update(
                      'humanAgentIds',
                      draft.humanAgentIds.filter((id) => id !== agent.id),
                    )
                  }
                  aria-label={`Remove ${agent.name}`}
                  className="cursor-pointer rounded-md p-0.5 text-n-slate-11 hover:bg-n-slate-3"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
            {unassigned.length > 0 && (
              <select
                value=""
                onChange={(e) =>
                  e.target.value &&
                  update('humanAgentIds', [...draft.humanAgentIds, e.target.value])
                }
                aria-label="Add human agent"
                className="h-8 min-w-[120px] flex-1 cursor-pointer bg-transparent text-sm text-n-slate-11 outline-none"
              >
                <option value="">+ Add agent</option>
                {unassigned.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Distribution */}
        <div className="flex flex-col gap-2">
          <label htmlFor="inbox-distribution" className="text-sm font-medium text-n-slate-12">
            Chat Distribution Method
          </label>
          <SelectField
            id="inbox-distribution"
            value={draft.distributionMethod}
            onChange={(e) => update('distributionMethod', e.target.value as ChatDistributionMethod)}
          >
            {DISTRIBUTION_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </SelectField>
        </div>

        {/* Toggles */}
        <div className="flex flex-col divide-y divide-n-weak">
          {SETTING_ROWS.map((row) => (
            <div key={row.key} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-6">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-n-slate-12">{row.title}</p>
                  <p className="mt-1 text-sm text-n-slate-11">{row.description}</p>
                </div>
                <Toggle
                  label={row.title}
                  checked={draft.settings[row.key]}
                  onChange={(checked) => updateSetting(row.key, checked)}
                />
              </div>
              {row.key === 'maxConversationsEnabled' && draft.settings.maxConversationsEnabled && (
                <label className="flex items-center gap-3 text-sm text-n-slate-11">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={limitInput}
                    onChange={(e) => {
                      setLimitInput(e.target.value);
                      const limit = Number(e.target.value);
                      if (Number.isInteger(limit) && limit >= 1 && limit <= 100) {
                        updateSetting('maxConversationsPerAgent', limit);
                      }
                    }}
                    onBlur={() => setLimitInput(String(draft.settings.maxConversationsPerAgent))}
                    className={cn(FIELD_CLASS, 'h-10 w-24')}
                  />
                  active conversations per agent
                </label>
              )}
            </div>
          ))}
        </div>
      </div>

      <Dialog
        open={confirmDelete}
        type="alert"
        role="alertdialog"
        width="sm"
        title={`Delete ${inbox.name}?`}
        description={`New messages from this ${platform.label} account will stop arriving. Existing conversations stay in the inbox history.`}
        confirmLabel="Delete"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => onDelete(inbox.id)}
      />
    </section>
  );
}
