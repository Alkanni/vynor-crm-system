'use client';

import React, { useState } from 'react';
import { Save, ShieldAlert, Sliders, Terminal, Bot, RotateCcw, Check } from 'lucide-react';
import type { AIAgentConfiguration, AIAgentState } from './types';
import { cn } from '@/lib/utils';

interface AIAgentConfigProps {
  config: AIAgentConfiguration;
  onSave: (updated: AIAgentConfiguration) => void;
}

export function AIAgentConfig({ config, onSave }: AIAgentConfigProps) {
  const [form, setForm] = useState<AIAgentConfiguration>(config);
  const [keywordInput, setKeywordInput] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const availableModels = [
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet (Recommended - Complex reasoning)' },
    { id: 'gpt-4o', name: 'GPT-4o (Fast multimodal)' },
    { id: 'gemini-1-5-pro', name: 'Gemini 1.5 Pro (Large context window)' },
  ];

  const channelOptions = [
    { id: 'chan_01', name: 'WhatsApp Business Official (+62 812-3456-7890)' },
    { id: 'chan_02', name: 'Instagram Direct (@vynor_support)' },
    { id: 'chan_03', name: 'Telegram Support Bot (@VynorSupportBot)' },
    { id: 'chan_06', name: 'Live Webchat Widget (vynor.io)' },
  ];

  const handleStateChange = (state: AIAgentState) => {
    setForm((prev) => ({ ...prev, state }));
  };

  const handleChannelToggle = (channelId: string) => {
    setForm((prev) => {
      const active = prev.assignedChannelIds.includes(channelId);
      return {
        ...prev,
        assignedChannelIds: active
          ? prev.assignedChannelIds.filter((id) => id !== channelId)
          : [...prev.assignedChannelIds, channelId],
      };
    });
  };

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keywordInput.trim()) return;
    const kw = keywordInput.trim().toLowerCase();
    if (!form.forbiddenKeywords.includes(kw)) {
      setForm((prev) => ({ ...prev, forbiddenKeywords: [...prev.forbiddenKeywords, kw] }));
    }
    setKeywordInput('');
  };

  const handleRemoveKeyword = (kw: string) => {
    setForm((prev) => ({
      ...prev,
      forbiddenKeywords: prev.forbiddenKeywords.filter((k) => k !== kw),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-xs select-none">
      {/* 1. Operational Mode Selector */}
      <div className="rounded-md border border-border bg-card p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-foreground text-sm">Autonomous Mode & State</h3>
          </div>
          <span className="text-[11px] text-muted-foreground">Select active autonomy level</span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            {
              state: 'AUTONOMOUS' as AIAgentState,
              label: 'Autonomous',
              desc: 'Answers customers directly without human review',
              bg: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
            },
            {
              state: 'COPILOT' as AIAgentState,
              label: 'Copilot / Draft',
              desc: 'Drafts responses for human agent sign-off',
              bg: 'border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-300',
            },
            {
              state: 'HANDOFF_REQUIRED' as AIAgentState,
              label: 'Handoff Alert',
              desc: 'Forces transfer on sentiment/confidence drop',
              bg: 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300',
            },
            {
              state: 'PAUSED' as AIAgentState,
              label: 'Disabled / Paused',
              desc: 'Suspends bot automation across all channels',
              bg: 'border-border bg-muted/60 text-muted-foreground',
            },
          ].map((item) => (
            <button
              key={item.state}
              type="button"
              onClick={() => handleStateChange(item.state)}
              className={cn(
                'flex flex-col rounded-xs border p-2.5 text-left transition-all cursor-pointer',
                form.state === item.state
                  ? `${item.bg} ring-2 ring-primary ring-offset-1`
                  : 'border-border bg-surface text-foreground hover:bg-muted/50',
              )}
            >
              <span className="font-semibold text-xs">{item.label}</span>
              <span className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                {item.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Model Architecture & Hyperparameters */}
      <div className="rounded-md border border-border bg-card p-4 shadow-2xs space-y-4">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground text-sm">LLM Engine & Hyperparameters</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Model Selector */}
          <div>
            <label className="font-medium text-foreground block mb-1">
              Underlying Foundation Model
            </label>
            <select
              value={form.model}
              onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
              className="h-8 w-full rounded-xs border border-border bg-surface px-2 text-xs text-foreground focus-visible:outline-hidden"
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Operating Hours */}
          <div>
            <label className="font-medium text-foreground block mb-1">Operating Hours</label>
            <input
              type="text"
              value={form.operatingHours}
              onChange={(e) => setForm((prev) => ({ ...prev, operatingHours: e.target.value }))}
              placeholder="e.g. 24/7 or Mon-Fri 08:00 - 20:00 WIB"
              className="h-8 w-full rounded-xs border border-border bg-surface px-2.5 text-xs text-foreground focus-visible:outline-hidden"
            />
          </div>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-2">
          {/* Temperature */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Temperature</span>
              <span className="font-mono font-semibold text-foreground">
                {form.temperature.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={form.temperature}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, temperature: parseFloat(e.target.value) }))
              }
              className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
            />
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              0.0 = Deterministic, 1.0 = Creative
            </span>
          </div>

          {/* Max Autonomous Turns */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Max Autonomous Turns</span>
              <span className="font-mono font-semibold text-foreground">
                {form.maxAutonomousTurns} turns
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={form.maxAutonomousTurns}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, maxAutonomousTurns: parseInt(e.target.value, 10) }))
              }
              className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
            />
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              Mandatory human handoff after N turns
            </span>
          </div>

          {/* Confidence Threshold */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Confidence Threshold</span>
              <span className="font-mono font-semibold text-foreground">
                {form.confidenceThreshold}%
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="99"
              step="1"
              value={form.confidenceThreshold}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, confidenceThreshold: parseInt(e.target.value, 10) }))
              }
              className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
            />
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              Escalates if RAG retrieval score drops
            </span>
          </div>
        </div>
      </div>

      {/* 3. System Persona Prompt */}
      <div className="rounded-md border border-border bg-card p-4 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-foreground text-sm">System Instruction & Persona</h3>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">
            Prompt engineering canvas
          </span>
        </div>

        <textarea
          rows={5}
          value={form.systemPrompt}
          onChange={(e) => setForm((prev) => ({ ...prev, systemPrompt: e.target.value }))}
          className="w-full rounded-xs border border-border bg-surface p-3 text-xs font-mono leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary"
          placeholder="You are the official VYNOR Support AI Assistant..."
        />
      </div>

      {/* 4. Guardrails & Assigned Channels */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Guardrails / Forbidden Topics */}
        <div className="rounded-md border border-border bg-card p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            <h3 className="font-semibold text-foreground text-sm">Safety Guardrails & Blacklist</h3>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Any mention of these keywords triggers immediate handoff to a human agent:
          </p>

          <div className="flex flex-wrap gap-1.5">
            {form.forbiddenKeywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 rounded-xs border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:text-rose-300"
              >
                <span>{kw}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveKeyword(kw)}
                  className="hover:text-rose-900 dark:hover:text-rose-100"
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-1.5 pt-1">
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="Add blacklisted keyword..."
              className="h-7 flex-1 rounded-xs border border-border bg-surface px-2 text-xs text-foreground focus-visible:outline-hidden"
            />
            <button
              type="button"
              onClick={handleAddKeyword}
              className="rounded-xs bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
            >
              Add
            </button>
          </div>
        </div>

        {/* Assigned Channels */}
        <div className="rounded-md border border-border bg-card p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-foreground text-sm">Assigned Inbound Inboxes</h3>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Channels where this AI agent handles incoming messages:
          </p>

          <div className="space-y-1.5">
            {channelOptions.map((ch) => {
              const checked = form.assignedChannelIds.includes(ch.id);
              return (
                <label
                  key={ch.id}
                  className="flex items-center gap-2 rounded-xs border border-border/60 bg-surface px-2.5 py-1.5 cursor-pointer hover:bg-muted/40 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleChannelToggle(ch.id)}
                    className="rounded-xs border-border text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                  <span className="font-medium text-foreground text-xs">{ch.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setForm(config)}
          className="inline-flex items-center gap-1.5 rounded-xs border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Reset Changes</span>
        </button>

        <div className="flex items-center gap-2">
          {savedSuccess && (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
              <Check className="h-3.5 w-3.5" />
              <span>Config Saved Successfully</span>
            </span>
          )}
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xs bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Configuration</span>
          </button>
        </div>
      </div>
    </form>
  );
}
