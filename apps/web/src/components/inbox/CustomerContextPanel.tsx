'use client';

import React, { useState } from 'react';
import {
  User,
  Tag,
  Ticket,
  Clock,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  PanelRightClose,
  Shield,
  Layers,
} from 'lucide-react';
import type { CustomerDetail, PriorityLevel } from './types';
import { ChannelBadge } from './ChannelBadge';
import { useUiStore } from '@/lib/store/ui-store';
import { cn } from '@/lib/utils';

interface CustomerContextPanelProps {
  customer: CustomerDetail;
  onUpdatePriority?: (priority: PriorityLevel) => void;
  onUpdateAssignee?: (assignee: string) => void;
  onAddTag?: (tag: string) => void;
  onRemoveTag?: (tag: string) => void;
}

export function CustomerContextPanel({
  customer,
  onUpdatePriority,
  onUpdateAssignee,
  onAddTag,
  onRemoveTag,
}: CustomerContextPanelProps) {
  const { customerContextOpen, toggleCustomerContext } = useUiStore();
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);

  // Accordion state
  const [openSections, setOpenSections] = useState({
    channels: true,
    tags: true,
    assignment: true,
    customFields: true,
    tickets: true,
    history: false,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAddTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTagInput.trim() && onAddTag) {
      onAddTag(newTagInput.trim());
      setNewTagInput('');
      setIsAddingTag(false);
    }
  };

  if (!customerContextOpen) {
    return null;
  }

  return (
    <aside
      aria-label="Customer Context Panel"
      className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-card overflow-hidden text-xs select-none"
    >
      {/* Panel Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3.5 bg-surface/50">
        <span className="font-semibold text-foreground tracking-tight text-xs uppercase text-muted-foreground">
          Customer Context
        </span>
        <button
          type="button"
          onClick={toggleCustomerContext}
          title="Collapse Context Panel (])"
          aria-label="Collapse Context Panel"
          className="rounded-xs p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      {/* Main Context Scroll Area */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/40 p-3 space-y-3.5">
        {/* 1. Contact Profile Header */}
        <div className="flex flex-col items-center text-center pt-1 pb-2">
          <div className="relative mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-base border border-border">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            {customer.isOnline && (
              <span
                title="Customer online"
                className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card"
              />
            )}
          </div>

          <h3 className="font-semibold text-foreground text-sm">{customer.name}</h3>
          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{customer.phone}</p>
          <p className="text-[11px] text-muted-foreground">{customer.email}</p>
        </div>

        {/* 2. Channel Identities */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => toggleSection('channels')}
            className="flex w-full items-center justify-between py-1 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider hover:text-foreground"
          >
            <div className="flex items-center gap-1.5">
              <Layers className="h-3 w-3 text-primary" />
              <span>Channel Identities ({customer.channelIdentities.length})</span>
            </div>
            {openSections.channels ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>

          {openSections.channels && (
            <div className="mt-1.5 space-y-1.5">
              {customer.channelIdentities.map((ch, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xs border border-border/60 bg-surface px-2 py-1 text-[11px]"
                >
                  <ChannelBadge channel={ch.channel} showLabel />
                  <span className="font-mono text-muted-foreground truncate max-w-[130px]">
                    {ch.identifier}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Assignment & Priority Controls */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => toggleSection('assignment')}
            className="flex w-full items-center justify-between py-1 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider hover:text-foreground"
          >
            <div className="flex items-center gap-1.5">
              <Shield className="h-3 w-3 text-primary" />
              <span>Triage & Assignment</span>
            </div>
            {openSections.assignment ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>

          {openSections.assignment && (
            <div className="mt-2 space-y-2">
              {/* Priority Selector */}
              <div>
                <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                  Priority SLA
                </label>
                <select
                  value={customer.priority}
                  onChange={(e) => onUpdatePriority?.(e.target.value as PriorityLevel)}
                  className="w-full h-7 rounded-xs border border-border bg-surface px-2 text-xs text-foreground focus-visible:outline-hidden"
                >
                  <option value="URGENT">Urgent (15m SLA)</option>
                  <option value="HIGH">High (1h SLA)</option>
                  <option value="MEDIUM">Medium (4h SLA)</option>
                  <option value="LOW">Low (24h SLA)</option>
                </select>
              </div>

              {/* Assignee Selector */}
              <div>
                <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                  Assigned Agent
                </label>
                <select
                  value={customer.assignedAgent}
                  onChange={(e) => onUpdateAssignee?.(e.target.value)}
                  className="w-full h-7 rounded-xs border border-border bg-surface px-2 text-xs text-foreground focus-visible:outline-hidden"
                >
                  <option value="Unassigned">Unassigned (Queue)</option>
                  <option value="Agent Smith">Agent Smith (You)</option>
                  <option value="Agent Sarah">Agent Sarah</option>
                  <option value="Agent Alex">Agent Alex</option>
                  <option value="Billing Support Team">Billing Support Team</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* 4. Active Labels / Tags */}
        <div className="pt-2">
          <div className="flex items-center justify-between py-1">
            <button
              type="button"
              onClick={() => toggleSection('tags')}
              className="flex items-center gap-1.5 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider hover:text-foreground"
            >
              <Tag className="h-3 w-3 text-primary" />
              <span>Tags ({customer.tags.length})</span>
              {openSections.tags ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsAddingTag(!isAddingTag)}
              title="Add Tag"
              className="rounded-xs p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {openSections.tags && (
            <div className="mt-1.5 space-y-1.5">
              <div className="flex flex-wrap gap-1">
                {customer.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-xs border border-border bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium text-foreground"
                  >
                    <span>#{tag}</span>
                    {onRemoveTag && (
                      <button
                        type="button"
                        onClick={() => onRemoveTag(tag)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </span>
                ))}
              </div>

              {isAddingTag && (
                <form onSubmit={handleAddTagSubmit} className="flex items-center gap-1 pt-1">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    placeholder="New tag..."
                    className="h-6 flex-1 rounded-xs border border-border bg-surface px-1.5 text-xs text-foreground outline-hidden"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="h-6 rounded-xs bg-primary px-2 text-[10px] font-medium text-primary-foreground"
                  >
                    Add
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* 5. Custom Fields */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => toggleSection('customFields')}
            className="flex w-full items-center justify-between py-1 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider hover:text-foreground"
          >
            <div className="flex items-center gap-1.5">
              <User className="h-3 w-3 text-primary" />
              <span>CRM Attributes</span>
            </div>
            {openSections.customFields ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>

          {openSections.customFields && (
            <div className="mt-1.5 space-y-1 divide-y divide-border/20">
              {Object.entries(customer.customFields).map(([key, value]) => (
                <div key={key} className="flex justify-between py-1 text-[11px]">
                  <span className="text-muted-foreground">{key}</span>
                  <span className="font-medium text-foreground font-mono text-right">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 6. Linked Tickets */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => toggleSection('tickets')}
            className="flex w-full items-center justify-between py-1 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider hover:text-foreground"
          >
            <div className="flex items-center gap-1.5">
              <Ticket className="h-3 w-3 text-primary" />
              <span>Linked Tickets ({customer.linkedTickets.length})</span>
            </div>
            {openSections.tickets ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>

          {openSections.tickets && (
            <div className="mt-1.5 space-y-1.5">
              {customer.linkedTickets.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xs border border-border/60 bg-surface p-2 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold text-primary">{t.id}</span>
                    <span
                      className={cn(
                        'rounded-xs px-1 text-[9px] font-semibold',
                        t.status === 'OPEN'
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                          : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
                      )}
                    >
                      {t.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-foreground truncate">{t.subject}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 7. Cross-Channel History */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => toggleSection('history')}
            className="flex w-full items-center justify-between py-1 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider hover:text-foreground"
          >
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-primary" />
              <span>Past Sessions ({customer.previousSessions.length})</span>
            </div>
            {openSections.history ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>

          {openSections.history && (
            <div className="mt-1.5 space-y-1.5">
              {customer.previousSessions.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xs border border-border/40 bg-muted/30 p-2 space-y-0.5"
                >
                  <div className="flex items-center justify-between">
                    <ChannelBadge channel={s.channel} />
                    <span className="font-mono text-[10px] text-muted-foreground">{s.date}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">{s.summary}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
