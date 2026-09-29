'use client';

import React, { useState } from 'react';
import { Clock, Copy, Layers, Mail, Phone, Plus, Shield, Tag, Ticket, User, X } from 'lucide-react';
import type { CustomerDetail, PriorityLevel } from './types';
import { ChannelBadge } from './ChannelBadge';
import { AccordionItem, Avatar, Button, Input, Label, Select } from '@/components/ui';
import { cn } from '@/lib/utils';

interface CustomerContextPanelProps {
  customer: CustomerDetail;
  onClose?: (() => void) | undefined;
  onUpdatePriority?: ((priority: PriorityLevel) => void) | undefined;
  onUpdateAssignee?: ((assignee: string) => void) | undefined;
  onAddTag?: ((tag: string) => void) | undefined;
  onRemoveTag?: ((tag: string) => void) | undefined;
  className?: string | undefined;
}

const TICKET_LABEL_COLOR = { OPEN: 'amber', IN_PROGRESS: 'iris', RESOLVED: 'teal' } as const;

/** Header strip — port of VYNOR `components-next/SidebarActionsHeader.vue`. */
function SidebarActionsHeader({
  title,
  onClose,
}: {
  title: string;
  onClose?: (() => void) | undefined;
}) {
  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-n-weak px-4 py-2">
      <div className="flex flex-1 items-center justify-between gap-2">
        <span className="text-sm font-medium text-n-slate-12">{title}</span>
        {onClose && (
          <Button
            variant="ghost"
            color="slate"
            size="sm"
            icon={X}
            aria-label="Close contact panel"
            title="Close (])"
            onClick={onClose}
          />
        )}
      </div>
    </div>
  );
}

/** Port of VYNOR `contact/ContactInfoRow.vue`. */
function ContactInfoRow({
  icon: Icon,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string | undefined }>;
  value: string;
  href?: string | undefined;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable (permissions); the value stays selectable.
    }
  };

  const content = (
    <>
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate text-sm" title={value}>
        {value || 'Not available'}
      </span>
    </>
  );

  return (
    <div className="group/row -ml-1 flex h-5 w-full items-center gap-1">
      {href ? (
        <a
          href={href}
          className="ml-1 flex min-w-0 items-center gap-2 text-n-slate-11 hover:underline"
        >
          {content}
        </a>
      ) : (
        <span className="ml-1 flex min-w-0 items-center gap-2 text-n-slate-11">{content}</span>
      )}
      {value && (
        <Button
          variant="ghost"
          color="slate"
          size="xs"
          icon={Copy}
          aria-label={copied ? 'Copied' : `Copy ${value}`}
          title={copied ? 'Copied' : 'Copy'}
          onClick={() => void copy()}
          className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100"
        />
      )}
    </div>
  );
}

/**
 * Contact panel — port of VYNOR `widgets/conversation/ConversationSidebar.vue`,
 * `conversation/ContactPanel.vue`, `contact/ContactInfo.vue` and
 * `Accordion/AccordionItem.vue` (`bg-n-surface-2`, 320px / 360px on 2xl).
 */
export function CustomerContextPanel({
  customer,
  onClose,
  onUpdatePriority,
  onUpdateAssignee,
  onAddTag,
  onRemoveTag,
  className,
}: CustomerContextPanelProps) {
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);

  const handleAddTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTagInput.trim() && onAddTag) {
      onAddTag(newTagInput.trim());
      setNewTagInput('');
      setIsAddingTag(false);
    }
  };

  return (
    <aside
      aria-label="Contact panel"
      className={cn(
        'flex h-full w-[320px] min-w-[320px] flex-col overflow-hidden border-l border-n-weak bg-n-surface-2 2xl:w-[360px] 2xl:min-w-[360px]',
        className,
      )}
    >
      <SidebarActionsHeader title="Contact" onClose={onClose} />

      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        {/* ContactInfo */}
        <div className="relative w-full items-center p-4">
          <div className="flex w-full flex-col gap-2 text-left">
            <Avatar
              name={customer.name}
              size={48}
              status={customer.isOnline ? 'online' : 'offline'}
              hideOfflineStatus
            />
            <div className="flex w-full min-w-0 flex-col items-start gap-1.5">
              <h3 className="my-0 max-w-full break-words text-base capitalize text-n-slate-12">
                {customer.name}
              </h3>
              <div className="flex w-full flex-col items-start gap-2">
                <ContactInfoRow
                  icon={Mail}
                  value={customer.email}
                  href={`mailto:${customer.email}`}
                />
                <ContactInfoRow
                  icon={Phone}
                  value={customer.phone}
                  href={`tel:${customer.phone}`}
                />
                {customer.customFields['Client ID'] && (
                  <ContactInfoRow icon={User} value={customer.customFields['Client ID']} />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Accordion sections */}
        <div className="flex flex-col gap-3 px-2 pb-8">
          <AccordionItem
            title="Triage & Assignment"
            icon={<Shield className="size-4" />}
            defaultOpen
          >
            <div className="flex flex-col gap-3">
              <Select
                label="Priority SLA"
                size="sm"
                value={customer.priority}
                onChange={(e) => onUpdatePriority?.(e.target.value as PriorityLevel)}
              >
                <option value="URGENT">Urgent (15m SLA)</option>
                <option value="HIGH">High (1h SLA)</option>
                <option value="MEDIUM">Medium (4h SLA)</option>
                <option value="LOW">Low (24h SLA)</option>
              </Select>
              <Select
                label="Assigned agent"
                size="sm"
                value={customer.assignedAgent}
                onChange={(e) => onUpdateAssignee?.(e.target.value)}
              >
                <option value="Unassigned">Unassigned (Queue)</option>
                <option value="Agent Smith">Agent Smith (You)</option>
                <option value="Agent Sarah">Agent Sarah</option>
                <option value="Agent Alex">Agent Alex</option>
                <option value="Billing Support Team">Billing Support Team</option>
              </Select>
            </div>
          </AccordionItem>

          <AccordionItem
            title={`Channel Identities (${customer.channelIdentities.length})`}
            icon={<Layers className="size-4" />}
            defaultOpen
          >
            <div className="flex flex-col gap-2">
              {customer.channelIdentities.map((ch) => (
                <div
                  key={`${ch.channel}-${ch.identifier}`}
                  className="flex items-center justify-between gap-2"
                >
                  <ChannelBadge channel={ch.channel} showLabel />
                  <span className="truncate text-sm text-n-slate-11">{ch.identifier}</span>
                </div>
              ))}
            </div>
          </AccordionItem>

          <AccordionItem
            title={`Tags (${customer.tags.length})`}
            icon={<Tag className="size-4" />}
            defaultOpen
            actions={
              onAddTag && (
                <Button
                  variant="ghost"
                  color="slate"
                  size="xs"
                  icon={Plus}
                  aria-label="Add tag"
                  onClick={() => setIsAddingTag((open) => !open)}
                  className="mr-2"
                />
              )
            }
          >
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {customer.tags.map((tag) => (
                  <Label
                    key={tag}
                    compact
                    label={tag}
                    action={
                      onRemoveTag && (
                        <button
                          type="button"
                          onClick={() => onRemoveTag(tag)}
                          aria-label={`Remove tag ${tag}`}
                          className="grid size-4 place-content-center rounded-lg text-n-slate-11 hover:text-n-slate-12"
                        >
                          <X className="size-3" />
                        </button>
                      )
                    }
                  />
                ))}
              </div>
              {isAddingTag && (
                <form onSubmit={handleAddTagSubmit} className="flex items-center gap-2">
                  <Input
                    size="sm"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    placeholder="New tag…"
                    aria-label="New tag"
                    containerClassName="flex-1"
                    autoFocus
                  />
                  <Button type="submit" size="sm" label="Add" />
                </form>
              )}
            </div>
          </AccordionItem>

          <AccordionItem title="CRM Attributes" icon={<User className="size-4" />} defaultOpen>
            <dl className="m-0 flex flex-col gap-2">
              {Object.entries(customer.customFields).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3 text-sm">
                  <dt className="text-n-slate-11">{key}</dt>
                  <dd className="m-0 truncate text-right text-n-slate-12">{value}</dd>
                </div>
              ))}
            </dl>
          </AccordionItem>

          <AccordionItem
            title={`Linked Tickets (${customer.linkedTickets.length})`}
            icon={<Ticket className="size-4" />}
          >
            <div className="flex flex-col gap-2">
              {customer.linkedTickets.map((t) => (
                <div key={t.id} className="flex flex-col gap-1 rounded-lg bg-n-alpha-1 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-n-slate-12">{t.id}</span>
                    <Label
                      compact
                      color={TICKET_LABEL_COLOR[t.status]}
                      label={t.status.replace('_', ' ').toLowerCase()}
                      className="capitalize"
                    />
                  </div>
                  <p className="mb-0 truncate text-sm text-n-slate-11">{t.subject}</p>
                </div>
              ))}
            </div>
          </AccordionItem>

          <AccordionItem
            title={`Previous Conversations (${customer.previousSessions.length})`}
            icon={<Clock className="size-4" />}
          >
            {customer.previousSessions.length === 0 ? (
              <p className="mb-0 text-sm text-n-slate-11">No previous conversations.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {customer.previousSessions.map((s) => (
                  <div key={s.id} className="flex flex-col gap-1 rounded-lg bg-n-alpha-1 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <ChannelBadge channel={s.channel} />
                      <span className="text-xs text-n-slate-10">{s.date}</span>
                    </div>
                    <p className="mb-0 text-sm leading-snug text-n-slate-11">{s.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </AccordionItem>
        </div>
      </div>
    </aside>
  );
}
