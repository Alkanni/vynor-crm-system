'use client';

import React from 'react';
import { ChevronRight, Tag, Workflow, X } from 'lucide-react';
import { AI_AGENT_LIMITS, type AiAgentGeneralSettings } from '@vynor/contracts';
import { CONVERSATION_LABELS, PIPELINE_STATUSES } from '@/lib/ai-agents/options';
import { SelectField } from '@/components/common/form-controls';
import { CountedTextarea } from '../ui';
import { cn } from '@/lib/utils';

interface AiActionsSettingsProps {
  general: AiAgentGeneralSettings;
  onChange: (patch: Partial<AiAgentGeneralSettings>) => void;
}

export function AiActionsSettings({ general, onChange }: AiActionsSettingsProps) {
  const remainingLabels = CONVERSATION_LABELS.filter((l) => !general.allowedLabels.includes(l));

  const togglePipeline = (status: string) =>
    onChange({
      allowedPipelineStatuses: general.allowedPipelineStatuses.includes(status)
        ? general.allowedPipelineStatuses.filter((s) => s !== status)
        : // Keep pipeline order so the saved list reads left to right.
          PIPELINE_STATUSES.map((s) => s.name).filter(
            (s) => s === status || general.allowedPipelineStatuses.includes(s),
          ),
    });

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600">
            <Tag className="size-3.5" />
          </span>
          <h4 className="text-sm font-semibold text-n-slate-12">Change Conversation Label</h4>
        </div>
        <p className="text-xs text-n-slate-11">
          Select labels that AI is allowed to use for tagging conversations automatically.
        </p>
        {general.allowedLabels.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {general.allowedLabels.map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--muted))] py-1 pl-3 pr-1.5 text-xs font-medium text-[hsl(var(--foreground))]"
              >
                {label}
                <button
                  type="button"
                  aria-label={`Remove label ${label}`}
                  onClick={() =>
                    onChange({ allowedLabels: general.allowedLabels.filter((l) => l !== label) })
                  }
                  className="cursor-pointer rounded-full p-0.5 text-n-slate-11 hover:bg-[hsl(var(--border))]"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        {remainingLabels.length > 0 && (
          <SelectField
            aria-label="Add label"
            value=""
            onChange={(e) =>
              e.target.value &&
              onChange({ allowedLabels: [...general.allowedLabels, e.target.value] })
            }
            className="h-11"
          >
            <option value="">+ Add label...</option>
            {remainingLabels.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </SelectField>
        )}
        <label htmlFor="label-conditions" className="mt-1 text-xs font-medium text-n-slate-12">
          Label Conditions
        </label>
        <p className="-mt-2 text-xs text-n-slate-11">
          Instructions for when AI should apply specific labels. Example: &ldquo;Apply label{' '}
          <span className="font-medium text-emerald-600">Purchased</span> when customer confirms a
          purchase&rdquo;
        </p>
        <CountedTextarea
          id="label-conditions"
          value={general.labelConditions}
          onChange={(labelConditions) => onChange({ labelConditions })}
          max={AI_AGENT_LIMITS.actionConditionsMax}
          rows={3}
          placeholder="One condition per line"
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-[hsl(var(--border))] pt-5">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-violet-500/15 text-violet-600">
            <Workflow className="size-3.5" />
          </span>
          <h4 className="text-sm font-semibold text-n-slate-12">
            Change Conversation Pipeline Status
          </h4>
        </div>
        <p className="text-xs text-n-slate-11">
          Select pipeline statuses that AI is allowed to move conversations to. AI can only move
          forward in the pipeline.
        </p>
        <div className="rounded-lg bg-[var(--n-alpha-black2)] p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-n-slate-10">
            Pipeline flow (AI can only move forward →)
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {PIPELINE_STATUSES.map((status, index) => {
              const on = general.allowedPipelineStatuses.includes(status.name);
              return (
                <React.Fragment key={status.name}>
                  {index > 0 && <ChevronRight className="size-3.5 text-n-slate-10" />}
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => togglePipeline(status.name)}
                    className={cn(
                      'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                      on
                        ? 'border-[hsl(var(--border-strong))] bg-[hsl(var(--surface))] text-[hsl(var(--foreground))]'
                        : 'border-transparent text-n-slate-10 hover:text-[hsl(var(--foreground))]',
                    )}
                  >
                    <span
                      className={cn(
                        'size-2 rounded-full',
                        status.dotClassName,
                        !on && 'opacity-40',
                      )}
                    />
                    {status.name}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
        <label htmlFor="pipeline-conditions" className="mt-1 text-xs font-medium text-n-slate-12">
          Pipeline Conditions
        </label>
        <p className="-mt-2 text-xs text-n-slate-11">
          When AI should move a conversation. Example: &ldquo;Move to Payment when customer asks for
          the bank account number&rdquo;
        </p>
        <CountedTextarea
          id="pipeline-conditions"
          value={general.pipelineConditions}
          onChange={(pipelineConditions) => onChange({ pipelineConditions })}
          max={AI_AGENT_LIMITS.actionConditionsMax}
          rows={3}
          placeholder="One condition per line"
        />
      </div>
    </>
  );
}
