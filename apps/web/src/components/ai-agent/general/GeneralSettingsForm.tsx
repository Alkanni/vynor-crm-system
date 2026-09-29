'use client';

import React, { useRef, useState } from 'react';
import { Clock, Cpu, ImagePlus, Trash2, Zap } from 'lucide-react';
import {
  AI_AGENT_LIMITS,
  AI_MODEL_TIERS,
  type AiAgentGeneralSettings,
  type AiModelTier,
} from '@vynor/contracts';
import { MODEL_TIER_OPTIONS } from '@/lib/ai-agents/options';
import { SelectField } from '@/components/common/form-controls';
import { CollapsibleCard, CountedTextarea, SettingHeading, SwitchRow } from '../ui';
import { AiActionsSettings } from './AiActionsSettings';
import { AdditionalSettings } from './AdditionalSettings';

const MAX_WELCOME_IMAGE_BYTES = 1_000_000;
const WELCOME_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

interface GeneralSettingsFormProps {
  name: string;
  onNameChange: (name: string) => void;
  lastTrained: string;
  general: AiAgentGeneralSettings;
  onChange: (patch: Partial<AiAgentGeneralSettings>) => void;
}

export function GeneralSettingsForm({
  name,
  onNameChange,
  lastTrained,
  general,
  onChange,
}: GeneralSettingsFormProps) {
  const imageInput = useRef<HTMLInputElement>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const model = MODEL_TIER_OPTIONS[general.model];

  const handleImage = (file: File | undefined) => {
    setImageError(null);
    if (!file) return;
    if (!WELCOME_IMAGE_TYPES.includes(file.type)) {
      setImageError('Use a PNG, JPG, GIF, or WebP image.');
      return;
    }
    if (file.size > MAX_WELCOME_IMAGE_BYTES) {
      setImageError('The image must be 1 MB or smaller.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange({ welcomeImage: String(reader.result) });
    reader.onerror = () => setImageError('The image could not be read. Try another file.');
    reader.readAsDataURL(file);
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col items-center gap-1 text-center">
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={AI_AGENT_LIMITS.nameMax}
          aria-label="Agent name"
          aria-invalid={!name.trim() || undefined}
          placeholder="Agent name"
          className="w-full rounded-md bg-transparent px-2 py-1 text-center text-lg font-semibold text-n-slate-12 outline-none placeholder:text-n-ruby-9 hover:bg-n-slate-3 focus:bg-n-slate-3"
        />
        <p className="text-sm font-medium text-n-slate-12">Last Trained: {lastTrained}</p>
      </div>

      <div className="flex flex-col gap-3">
        <SettingHeading
          htmlFor="agent-behavior"
          title="AI Agent Behavior"
          description="This is the AI Prompt that defines the AI's speaking style and identity."
        />
        <CountedTextarea
          id="agent-behavior"
          value={general.behavior}
          onChange={(behavior) => onChange({ behavior })}
          max={AI_AGENT_LIMITS.behaviorMax}
          rows={10}
          placeholder="Example: You are the customer service of our store. Reply briefly and politely, and only use information from the knowledge sources."
        />
      </div>

      <div className="flex flex-col gap-3">
        <SettingHeading
          htmlFor="agent-welcome"
          title="Welcome Message"
          help="Sent once, before the AI's first answer in a conversation."
          description="The first message the AI will send to the user."
        />
        <div className="flex flex-col items-center gap-2">
          <input
            ref={imageInput}
            type="file"
            accept={WELCOME_IMAGE_TYPES.join(',')}
            className="hidden"
            onChange={(e) => {
              handleImage(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {general.welcomeImage ? (
            <div className="flex items-center gap-3">
              <img
                src={general.welcomeImage}
                alt="Welcome message attachment"
                className="h-20 w-auto rounded-lg border border-n-weak object-cover"
              />
              <div className="flex flex-col items-start gap-1">
                <button
                  type="button"
                  onClick={() => imageInput.current?.click()}
                  className="cursor-pointer text-sm font-medium text-n-blue-11 hover:underline"
                >
                  Replace image
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ welcomeImage: null })}
                  className="inline-flex cursor-pointer items-center gap-1 text-sm text-n-slate-11 hover:text-n-ruby-11"
                >
                  <Trash2 className="size-3.5" />
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => imageInput.current?.click()}
              className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-n-blue-11 hover:underline"
            >
              <ImagePlus className="size-4" />
              Upload image for Welcome Message
            </button>
          )}
          {imageError && (
            <p role="alert" className="text-xs text-n-ruby-9">
              {imageError}
            </p>
          )}
        </div>
        <CountedTextarea
          id="agent-welcome"
          value={general.welcomeMessage}
          onChange={(welcomeMessage) => onChange({ welcomeMessage })}
          max={AI_AGENT_LIMITS.welcomeMessageMax}
          rows={3}
          placeholder="Hi! I'm the virtual assistant. How can I help you today?"
        />
      </div>

      <div className="flex flex-col gap-3">
        <SettingHeading
          htmlFor="agent-transfer"
          title="Agent Transfer Conditions"
          description={
            <>
              Define conditions that trigger the AI to transfer the chat to a human agent. Chat
              status will become <span className="font-medium text-n-ruby-9">Pending</span> and
              appear in the <span className="font-medium text-n-iris-11">Assigned</span> tab.
            </>
          }
        />
        <CountedTextarea
          id="agent-transfer"
          value={general.transferConditions}
          onChange={(transferConditions) => onChange({ transferConditions })}
          max={AI_AGENT_LIMITS.transferConditionsMax}
          rows={4}
          placeholder="One condition per line, e.g. Customer asks for a refund."
        />
      </div>

      <div className="flex flex-col gap-5">
        <SwitchRow
          title="Stop AI after Handoff"
          description={
            <>
              Stop the AI from sending messages after the chat status changes to{' '}
              <span className="text-n-ruby-9">Pending</span>.
            </>
          }
          checked={general.stopAfterHandoff}
          onChange={(stopAfterHandoff) => onChange({ stopAfterHandoff })}
        />
        <SwitchRow
          title="Silent Agent Handoff"
          description="AI silently transfers the conversation to an agent with no further AI replies."
          checked={general.silentHandoff}
          onChange={(silentHandoff) => onChange({ silentHandoff })}
        />
      </div>

      <CollapsibleCard
        icon={<Clock className="size-5" />}
        iconClassName="bg-n-violet-9"
        title="Pending status messages"
        description="Set messages customers receive while waiting for handoff"
      >
        {!general.stopAfterHandoff && (
          <p className="rounded-lg bg-n-amber-9/10 px-3 py-2 text-xs text-n-amber-11">
            These messages are sent only while Stop AI after Handoff is on.
          </p>
        )}
        {(
          [
            {
              key: 'pendingAssignedMessage',
              title: 'Pending - assigned message',
              badge: 'Assigned tab',
              badgeClass: 'text-n-iris-11 bg-n-iris-9/10',
              description:
                'Sent when Stop AI after Handoff is on and a pending chat already has an assigned agent.',
              placeholder: 'Enter message for pending assigned conversations',
            },
            {
              key: 'pendingUnassignedMessage',
              title: 'Pending - unassigned message',
              badge: 'Unassigned tab',
              badgeClass: 'text-n-amber-11 bg-n-amber-9/10',
              description: 'Sent when Stop AI after Handoff is on and no agent is assigned yet.',
              placeholder: 'Enter message for pending unassigned conversations',
            },
          ] as const
        ).map((item) => (
          <div key={item.key} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor={item.key} className="text-sm font-semibold text-n-slate-12">
                {item.title}
              </label>
              <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${item.badgeClass}`}>
                {item.badge}
              </span>
            </div>
            <p className="text-xs text-n-slate-11">{item.description}</p>
            <CountedTextarea
              id={item.key}
              value={general[item.key]}
              onChange={(value) => onChange({ [item.key]: value })}
              max={AI_AGENT_LIMITS.pendingMessageMax}
              rows={2}
              className="min-h-16"
              placeholder={item.placeholder}
            />
          </div>
        ))}
      </CollapsibleCard>

      <CollapsibleCard
        icon={<Zap className="size-5" />}
        iconClassName="bg-n-iris-9"
        title="AI Actions"
        description="Configure labels and pipeline statuses that AI can use automatically"
      >
        <AiActionsSettings general={general} onChange={onChange} />
      </CollapsibleCard>

      <div className="flex flex-col gap-3 rounded-xl border border-n-weak p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-n-teal-10 text-white">
            <Cpu className="size-5" />
          </span>
          <div>
            <label htmlFor="agent-model" className="block text-sm font-semibold text-n-slate-12">
              AI Model
            </label>
            <p className="text-xs text-n-slate-11">Select your AI model</p>
          </div>
        </div>
        <SelectField
          id="agent-model"
          value={general.model}
          onChange={(e) => onChange({ model: e.target.value as AiModelTier })}
        >
          {AI_MODEL_TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {MODEL_TIER_OPTIONS[tier].label} — ~{MODEL_TIER_OPTIONS[tier].credits} credits per
              response
            </option>
          ))}
        </SelectField>
        <p className="text-xs text-n-slate-11">{model.description}</p>
        <p className="text-xs italic text-n-slate-10">
          Note: AI credit usage depends on prompt complexity and tools used. The displayed amount is
          an estimate and may vary.
        </p>
      </div>

      <AdditionalSettings general={general} onChange={onChange} />
    </div>
  );
}
