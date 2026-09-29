'use client';

import React, { useState } from 'react';
import { ArrowRight, Filter, Plus, Zap } from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { StatusBadge } from '@/components/layout/Section';
import { Button, CardLayout, Switch, useToast } from '@/components/ui';
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

const STEPS = [
  { key: 'trigger', label: 'When', icon: Zap, tone: 'text-n-blue-11', strip: 'WHEN ' },
  { key: 'condition', label: 'If', icon: Filter, tone: 'text-n-amber-11', strip: 'IF ' },
  { key: 'action', label: 'Then', icon: ArrowRight, tone: 'text-n-teal-11', strip: 'THEN ' },
] as const;

export default function AutomationsBuilderPage() {
  const [rules, setRules] = useState<AutomationRule[]>(MOCK_RULES);
  const toast = useToast();

  const handleToggleRule = (id: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r)));
  };

  return (
    <PageLayout
      title="Automations"
      description="Build WHEN → IF → THEN routing rules that run on every conversation event."
      actions={
        <Button
          size="sm"
          icon={Plus}
          label="Add automation"
          onClick={() => toast.show('The rule builder opens in the production workspace.', 'info')}
        />
      }
    >
      <div className="flex flex-col gap-4">
        {rules.map((rule) => (
          <CardLayout key={rule.id} className={cn(!rule.isActive && 'opacity-70')}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="m-0 text-base font-medium text-n-slate-12">{rule.name}</h3>
                <span className="text-sm text-n-slate-11">
                  Fired{' '}
                  <span className="tabular-nums text-n-slate-12">{rule.executionCount24h}</span>{' '}
                  times in 24h · last {rule.lastFiredAt}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <StatusBadge tone={rule.isActive ? 'teal' : 'slate'}>
                  {rule.isActive ? 'Active' : 'Disabled'}
                </StatusBadge>
                <Switch
                  checked={rule.isActive}
                  onChange={() => handleToggleRule(rule.id)}
                  label={`${rule.isActive ? 'Disable' : 'Enable'} ${rule.name}`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {STEPS.map(({ key, label, icon: Icon, tone, strip }) => (
                <div key={key} className="flex flex-col gap-1 rounded-lg bg-n-alpha-1 px-3 py-2.5">
                  <span
                    className={cn('inline-flex items-center gap-1.5 text-xs font-medium', tone)}
                  >
                    <Icon className="size-3.5" />
                    {label}
                  </span>
                  <p className="m-0 text-sm text-n-slate-12">{rule[key].replace(strip, '')}</p>
                </div>
              ))}
            </div>
          </CardLayout>
        ))}
      </div>
      {toast.element}
    </PageLayout>
  );
}
