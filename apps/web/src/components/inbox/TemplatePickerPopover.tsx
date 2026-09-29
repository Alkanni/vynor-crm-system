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
      role="listbox"
      aria-label="Canned responses"
      className="absolute bottom-full left-0 z-50 mb-2 w-80 max-w-[calc(100vw-2rem)] select-none rounded-xl border border-n-weak bg-n-alpha-3 p-2 text-sm shadow-sm backdrop-blur-[100px] animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      <div className="mb-2 mt-1 flex items-center gap-1.5 px-2 text-xs font-medium tracking-[0.2px] text-n-slate-10">
        <Search className="size-3" />
        <span>Canned responses ({filtered.length})</span>
      </div>

      <div className="grid max-h-56 gap-1 overflow-y-auto">
        {filtered.map((item, index) => {
          const isSelected = index === selectedIndex;
          return (
            <div
              key={item.trigger}
              role="option"
              aria-selected={isSelected}
              tabIndex={-1}
              onClick={() => onSelect(item.content)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={cn(
                'flex cursor-pointer flex-col gap-0.5 rounded-lg p-2 text-left text-n-slate-12 transition-colors',
                isSelected && 'bg-n-alpha-2',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{item.trigger}</span>
                <span className="shrink-0 rounded-md bg-n-alpha-2 px-1.5 text-xs text-n-slate-11">
                  {item.category}
                </span>
              </div>
              <span className="truncate text-xs text-n-slate-11">{item.title}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex justify-between border-t border-n-weak px-2 pt-2 text-xs text-n-slate-10">
        <span>↑↓ navigate</span>
        <span>↵ insert</span>
      </div>
    </div>
  );
}
