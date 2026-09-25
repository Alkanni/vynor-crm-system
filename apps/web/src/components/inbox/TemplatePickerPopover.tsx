'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import type { CannedTemplate } from './types';
import { cn } from '@/lib/utils';

export const CANNED_TEMPLATES: CannedTemplate[] = [
  {
    trigger: '/greeting',
    title: 'Customer Greeting (General)',
    content: 'Hello! Thank you for reaching out to VYNOR Support. How may I assist you today?',
    category: 'Greetings',
  },
  {
    trigger: '/pricing',
    title: 'Enterprise Plan Overview',
    content:
      'Our VYNOR CRM Enterprise Plan includes unlimited omnichannel connections, custom AI Agent workflows, and 24/7 dedicated SLA support.',
    category: 'Support',
  },
  {
    trigger: '/refund_policy',
    title: 'Refund Status Notice',
    content:
      'We have initiated the refund review with our finance department. Approvals typically take 2-4 business days.',
    category: 'Billing',
  },
  {
    trigger: '/closing_ticket',
    title: 'Resolution Confirmation',
    content:
      "Thank you for contacting us! Since your inquiry has been resolved, I'll close this ticket. Feel free to reply if you need further help.",
    category: 'Resolution',
  },
  {
    trigger: '/technical_escalation',
    title: 'Technical Escalation Notification',
    content:
      "I have escalated your ticket to our Tier-2 engineering team along with the system telemetry logs. We'll update you as soon as possible.",
    category: 'Support',
  },
];

interface TemplatePickerPopoverProps {
  query: string;
  isOpen: boolean;
  onSelect: (content: string) => void;
  onClose: () => void;
}

export function TemplatePickerPopover({
  query,
  isOpen,
  onSelect,
  onClose,
}: TemplatePickerPopoverProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const cleanQuery = query.replace(/^\//, '').toLowerCase();

  const filtered = CANNED_TEMPLATES.filter(
    (t) =>
      t.trigger.toLowerCase().includes(cleanQuery) ||
      t.title.toLowerCase().includes(cleanQuery) ||
      t.category.toLowerCase().includes(cleanQuery),
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (filtered[selectedIndex]) {
          e.preventDefault();
          onSelect(filtered[selectedIndex].content);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onSelect, onClose]);

  if (!isOpen || filtered.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full mb-2 left-0 z-50 w-80 max-w-sm rounded-md border border-border bg-card p-1 shadow-xl animate-in fade-in slide-in-from-bottom-2 select-none"
    >
      <div className="flex items-center gap-1.5 border-b border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground">
        <Search className="h-3 w-3" />
        <span>Select Template ({filtered.length})</span>
      </div>

      <div className="max-h-56 overflow-y-auto py-1">
        {filtered.map((item, index) => {
          const isSelected = index === selectedIndex;
          return (
            <div
              key={item.trigger}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(item.content)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={cn(
                'flex flex-col gap-0.5 rounded-xs px-2.5 py-1.5 cursor-pointer text-left transition-colors',
                isSelected
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-foreground hover:bg-muted',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold">{item.trigger}</span>
                <span
                  className={cn(
                    'text-[10px] rounded-xs px-1',
                    isSelected
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {item.category}
                </span>
              </div>
              <span
                className={cn(
                  'text-[11px] truncate',
                  isSelected ? 'text-primary-foreground/90' : 'text-muted-foreground',
                )}
              >
                {item.title}
              </span>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border px-2 py-1 text-[10px] text-muted-foreground flex justify-between">
        <span>↑↓ Navigate</span>
        <span>↵ Insert Template</span>
      </div>
    </div>
  );
}
