'use client';

import React, { useState } from 'react';
import {
  Workflow,
  Plus,
  Play,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Filter,
  Zap,
  Tag,
  Shield,
  Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AutomationRule {
  id: string;
  name: string;
  isActive: boolean;
  trigger: string;
  condition: string;
  action: string;
  executionCount24h: number;
  lastFiredAt: string;
}

const MOCK_RULES: AutomationRule[] = [
  {
    id: 'rule_01',
    name: 'Auto-Route VIP Customers to Senior Account Managers',
    isActive: true,
    trigger: 'WHEN Inbound message received',
    condition: 'IF Contact Tag contains #vip-customer AND Channel is WhatsApp',
    action: 'THEN Assign to Team "Account Operations" AND Set Priority to "URGENT"',
    executionCount24h: 142,
    lastFiredAt: '3m ago',
  },
  {
    id: 'rule_02',
    name: 'Autonomous AI Triage for Common Product FAQs',
    isActive: true,
    trigger: 'WHEN Conversation created in Unassigned Queue',
    condition: 'IF Message contains keywords [harga, fitur, integrasi, api] AND Shift is Active',
    action: 'THEN Engage Autonomous AI Bot AND Monitor Confidence Score (>85%)',
    executionCount24h: 538,
    lastFiredAt: 'Just now',
  },
  {
    id: 'rule_03',
    name: 'Escalate Unanswered Conversations at 80% SLA Threshold',
    isActive: true,
    trigger: 'WHEN First response timer exceeds 4 minutes',
    condition: 'IF Conversation State is OPEN AND Assigned Agent has not replied',
    action: 'THEN Broadcast Collision Alert to Shift Supervisor AND Tag #sla-warning',
    executionCount24h: 12,
    lastFiredAt: '45m ago',
  },
  {
    id: 'rule_04',
    name: 'Auto-Apply #wholesale Label on Business Tax Inquiries',
    isActive: false,
    trigger: 'WHEN Inbound message contains "NPWP" OR "Faktur Pajak"',
    condition: 'IF Channel is WhatsApp OR Email',
    action: 'THEN Apply Tag #billing-inquiry AND Assign to "Billing & Support"',
    executionCount24h: 0,
    lastFiredAt: '2 days ago',
  },
];

export default function AutomationsBuilderPage() {
  const [rules, setRules] = useState<AutomationRule[]>(MOCK_RULES);

  const handleToggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r)),
    );
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Event Automations & Linear Routing Rules
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Construct robust WHEN &rarr; IF &rarr; THEN workflow triggers without brittle visual block spaghetti
          </p>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-xs bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-2xs hover:bg-primary-hover transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Automation Rule</span>
        </button>
      </div>

      {/* Rules Linear Stack */}
      <div className="space-y-4">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className={cn(
              'rounded-md border p-5 transition-all shadow-2xs',
              rule.isActive
                ? 'bg-card border-border hover:border-border-strong'
                : 'bg-muted/30 border-border opacity-70',
            )}
          >
            {/* Top Line: Rule Title, Status Pill & Toggle */}
            <div className="flex items-center justify-between gap-4 pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'h-2.5 w-2.5 rounded-full shrink-0',
                    rule.isActive ? 'bg-emerald-500' : 'bg-muted-foreground',
                  )}
                />
                <h3 className="text-sm font-semibold text-foreground">{rule.name}</h3>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground">
                  Fired <strong>{rule.executionCount24h}</strong> times (24h)
                </span>
                <button
                  type="button"
                  onClick={() => handleToggleRule(rule.id)}
                  className={cn(
                    'rounded-xs px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer border',
                    rule.isActive
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                      : 'bg-muted text-muted-foreground border-border',
                  )}
                >
                  {rule.isActive ? 'Active' : 'Disabled'}
                </button>
              </div>
            </div>

            {/* Linear Logic Chain: WHEN -> IF -> THEN */}
            <div className="mt-3.5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {/* Trigger */}
              <div className="rounded-xs border border-border bg-surface p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-primary font-mono font-bold text-[10px] uppercase tracking-wider">
                  <Zap className="h-3 w-3" />
                  <span>TRIGGER (WHEN)</span>
                </div>
                <p className="text-foreground font-medium">{rule.trigger.replace('WHEN ', '')}</p>
              </div>

              {/* Condition */}
              <div className="rounded-xs border border-border bg-surface p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-mono font-bold text-[10px] uppercase tracking-wider">
                  <Filter className="h-3 w-3" />
                  <span>CONDITION (IF)</span>
                </div>
                <p className="text-foreground font-medium">{rule.condition.replace('IF ', '')}</p>
              </div>

              {/* Action */}
              <div className="rounded-xs border border-border bg-surface p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-[10px] uppercase tracking-wider">
                  <ArrowRight className="h-3 w-3" />
                  <span>ACTION (THEN)</span>
                </div>
                <p className="text-foreground font-medium">{rule.action.replace('THEN ', '')}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
