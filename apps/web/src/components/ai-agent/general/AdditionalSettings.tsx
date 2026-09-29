'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { AiAgentGeneralSettings, AiTemperatureLevel } from '@vynor/contracts';
import { AI_TEMPERATURE_LEVELS } from '@vynor/contracts';
import { TEMPERATURE_OPTIONS, TIMEZONE_OPTIONS } from '@/lib/ai-agents/options';
import { SelectField } from '@/components/common/form-controls';
import { NumberField, SettingHeading } from '../ui';
import { cn } from '@/lib/utils';

interface AdditionalSettingsProps {
  general: AiAgentGeneralSettings;
  onChange: (patch: Partial<AiAgentGeneralSettings>) => void;
}

type NumericKey =
  'historyLimit' | 'readFileLimit' | 'contextLimit' | 'messageAwaitSeconds' | 'messageLimit';

const NUMERIC_SETTINGS: {
  key: NumericKey;
  title: string;
  description: string;
  help: string;
  min: number;
  max: number;
  suffix?: string;
}[] = [
  {
    key: 'historyLimit',
    title: 'AI History Limit',
    description: 'The number of messages the AI will remember.',
    help: 'Older messages beyond this count are not sent to the AI. Between 1 and 100.',
    min: 1,
    max: 100,
  },
  {
    key: 'readFileLimit',
    title: 'AI Read File Limit',
    description: 'The number of recent messages whose file attachments the AI will read.',
    help: 'Set 0 to ignore attachments. Between 0 and 20.',
    min: 0,
    max: 20,
  },
  {
    key: 'contextLimit',
    title: 'AI Context Limit',
    description:
      'AI depth level for reading knowledge sources. Increase this if you have more knowledge entries.',
    help: 'How many knowledge entries the AI reads for each answer. Between 1 and 100.',
    min: 1,
    max: 100,
  },
];

const TIMING_SETTINGS: typeof NUMERIC_SETTINGS = [
  {
    key: 'messageAwaitSeconds',
    title: 'Message Await',
    description: 'Delay time before the AI responds to a user message.',
    help: 'Messages sent during the wait are answered together. Between 0 and 120 seconds.',
    min: 0,
    max: 120,
    suffix: 'seconds',
  },
  {
    key: 'messageLimit',
    title: 'AI Message Limit',
    description:
      'Limit on the number of AI messages per conversation session. Resets when the chat is resolved.',
    help: 'Between 1 and 200 messages.',
    min: 1,
    max: 200,
  },
];

function NumericSetting({
  setting,
  general,
  onChange,
}: {
  setting: (typeof NUMERIC_SETTINGS)[number];
  general: AiAgentGeneralSettings;
  onChange: AdditionalSettingsProps['onChange'];
}) {
  const id = `setting-${setting.key}`;
  return (
    <div className="flex flex-col gap-2">
      <SettingHeading
        htmlFor={id}
        title={setting.title}
        description={setting.description}
        help={setting.help}
      />
      <NumberField
        id={id}
        value={general[setting.key]}
        min={setting.min}
        max={setting.max}
        onChange={(value) => onChange({ [setting.key]: value })}
        {...(setting.suffix ? { suffix: setting.suffix } : {})}
      />
    </div>
  );
}

function OnOffSetting({
  id,
  title,
  description,
  help,
  value,
  onChange,
}: {
  id: string;
  title: string;
  description: string;
  help: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <SettingHeading htmlFor={id} title={title} description={description} help={help} />
      <SelectField
        id={id}
        value={value ? 'on' : 'off'}
        onChange={(e) => onChange(e.target.value === 'on')}
        className="h-11"
      >
        <option value="off">Off</option>
        <option value="on">On</option>
      </SelectField>
    </div>
  );
}

export function AdditionalSettings({ general, onChange }: AdditionalSettingsProps) {
  const [open, setOpen] = useState(false);
  const timezones = TIMEZONE_OPTIONS.some((tz) => tz.value === general.timezone)
    ? TIMEZONE_OPTIONS
    : [{ value: general.timezone, label: general.timezone }, ...TIMEZONE_OPTIONS];

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="additional-settings"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex cursor-pointer items-center justify-center gap-1.5 self-center rounded-lg px-3 py-1.5 text-sm font-semibold text-n-blue-11 hover:bg-n-blue-2"
      >
        Additional Settings
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div id="additional-settings" className="flex flex-col gap-6">
          {NUMERIC_SETTINGS.map((setting) => (
            <NumericSetting
              key={setting.key}
              setting={setting}
              general={general}
              onChange={onChange}
            />
          ))}

          <div className="flex flex-col gap-2">
            <SettingHeading
              htmlFor="setting-temperature"
              title="AI Temperature"
              description="The creativity level of the AI when responding to user messages."
              help="Precise keeps replies short and factual; Creative is warmer and more expressive."
            />
            <SelectField
              id="setting-temperature"
              value={general.temperature}
              onChange={(e) => onChange({ temperature: e.target.value as AiTemperatureLevel })}
              className="h-11"
            >
              {AI_TEMPERATURE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {TEMPERATURE_OPTIONS[level].label} — {TEMPERATURE_OPTIONS[level].hint}
                </option>
              ))}
            </SelectField>
          </div>

          {TIMING_SETTINGS.map((setting) => (
            <NumericSetting
              key={setting.key}
              setting={setting}
              general={general}
              onChange={onChange}
            />
          ))}

          <OnOffSetting
            id="setting-watcher"
            title="Watcher"
            description="Monitors AI responses to ensure important functions are executed."
            help="Checks each reply and runs a handoff, label, or pipeline action the AI promised but skipped. Applies in live conversations."
            value={general.watcherEnabled}
            onChange={(watcherEnabled) => onChange({ watcherEnabled })}
          />

          <div className="flex flex-col gap-2">
            <SettingHeading
              htmlFor="setting-timezone"
              title="Timezone"
              description="Select the timezone for the AI."
              help="Used for greetings and when the AI talks about dates and opening hours."
            />
            <SelectField
              id="setting-timezone"
              value={general.timezone}
              onChange={(e) => onChange({ timezone: e.target.value })}
              className="h-11"
            >
              {timezones.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </SelectField>
          </div>

          <OnOffSetting
            id="setting-session-memory"
            title="Session-Only Memory"
            description="When enabled, AI will start conversation without remembering previous session(s)"
            help="A session ends when the chat is resolved."
            value={general.sessionOnlyMemory}
            onChange={(sessionOnlyMemory) => onChange({ sessionOnlyMemory })}
          />
        </div>
      )}
    </div>
  );
}
