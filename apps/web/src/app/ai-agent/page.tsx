'use client';

import React, { useState } from 'react';
import { Bot, Sliders, PlayCircle, AlertOctagon, CheckCircle2, RefreshCw } from 'lucide-react';
import { AIAgentConfig } from '@/components/ai-agent/AIAgentConfig';
import { AIPlayground } from '@/components/ai-agent/AIPlayground';
import type { AIAgentConfiguration } from '@/components/ai-agent/types';
import { cn } from '@/lib/utils';

const DEFAULT_CONFIG: AIAgentConfiguration = {
  id: 'agent_core_01',
  name: 'VYNOR Autonomous Tier-1 Support Agent',
  state: 'AUTONOMOUS',
  model: 'claude-3-5-sonnet',
  systemPrompt: `Anda adalah agen AI customer care internal untuk VYNOR CRM. 
Tugas utama Anda adalah menjawab pertanyaan pelanggan mengenai status pesanan, onboarding integrasi channel, dan informasi layanan dasar dengan ramah, akurat, dan ringkas.
PENTING:
- Jangan pernah memberikan informasi rahasia kredensial, token API, atau password.
- Jika pengguna meminta pengembalian dana (refund) atau mengeluhkan kegagalan transaksi berulang, segera eskalasikan ke agen manusia dengan status HANDOFF.
- Jawab dalam Bahasa Indonesia yang formal dan bersahabat.`,
  temperature: 0.3,
  maxTokens: 1024,
  maxAutonomousTurns: 4,
  confidenceThreshold: 0.85,
  forbiddenKeywords: [
    'password',
    'secret',
    'token api',
    'refund tunai',
    'database',
    'internal admin',
  ],
  assignedChannelIds: ['chan_01', 'chan_03', 'chan_06'],
  operatingHours: '24/7 Always Active',
};

export default function AIAgentPage() {
  const [config, setConfig] = useState<AIAgentConfiguration>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState<'config' | 'playground'>('playground');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSaveConfig = (updated: AIAgentConfiguration) => {
    setConfig(updated);
    showToast('AI Agent parameters and guardrails successfully synchronized.');
  };

  const handleEmergencyKill = () => {
    setConfig((prev) => ({
      ...prev,
      state: 'PAUSED',
    }));
    showToast('EMERGENCY KILL SWITCH ENGAGED: AI Agent suspended across all channels!');
  };

  const handleResumeAgent = () => {
    setConfig((prev) => ({
      ...prev,
      state: 'AUTONOMOUS',
    }));
    showToast('AI Agent resumed autonomous operation.');
  };

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto w-full p-6 select-none overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 right-6 z-50 flex items-center gap-2 rounded-xs border border-emerald-500/40 bg-zinc-900 p-3 text-xs text-zinc-100 shadow-xl animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 shrink-0">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
              <Bot className="h-5 w-5 text-emerald-400" />
              <span>AI Agent Supervisor Console</span>
            </h1>
            <span
              className={cn(
                'px-2 py-0.5 rounded text-[11px] font-mono font-semibold uppercase tracking-wider',
                config.state === 'AUTONOMOUS' &&
                  'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
                config.state === 'COPILOT' &&
                  'bg-blue-500/10 text-blue-400 border border-blue-500/30',
                config.state === 'HANDOFF_REQUIRED' &&
                  'bg-amber-500/10 text-amber-400 border border-amber-500/30',
                (config.state === 'PAUSED' || config.state === 'ERROR') &&
                  'bg-red-500/10 text-red-400 border border-red-500/30',
              )}
            >
              {config.state}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Supervise generative models, tune confidence thresholds, enforce guardrail filters, and
            test conversational safety in the isolated sandbox.
          </p>
        </div>

        {/* Global Kill Switch & Mode Tabs */}
        <div className="flex items-center space-x-3">
          {config.state === 'PAUSED' || config.state === 'ERROR' ? (
            <button
              onClick={handleResumeAgent}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Resume AI Operations</span>
            </button>
          ) : (
            <button
              onClick={handleEmergencyKill}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/40 rounded text-xs font-semibold transition-colors"
              title="Immediately halts all autonomous responses across all channels"
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>Emergency Kill Switch</span>
            </button>
          )}

          {/* Tab Navigation */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 p-0.5 rounded-lg text-xs font-medium">
            <button
              onClick={() => setActiveTab('playground')}
              className={cn(
                'flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-colors',
                activeTab === 'playground'
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200',
              )}
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span>Sanitized Playground</span>
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={cn(
                'flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-colors',
                activeTab === 'config'
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200',
              )}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Configuration & Guardrails</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'playground' ? (
          <AIPlayground config={config} onEmergencyKill={handleEmergencyKill} />
        ) : (
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-6">
            <AIAgentConfig config={config} onSave={handleSaveConfig} />
          </div>
        )}
      </div>
    </div>
  );
}
