'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Inbox,
  Users,
  Radio,
  Bot,
  Megaphone,
  FileSpreadsheet,
  Ticket,
  Cpu,
  FileCode,
  LayoutDashboard,
  BarChart2,
  Settings,
  Moon,
  Sun,
  HelpCircle,
} from 'lucide-react';
import { useUiStore } from '@/lib/store/ui-store';
import { cn } from '@/lib/utils';

interface PaletteItem {
  id: string;
  title: string;
  category: 'Navigation' | 'Actions';
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  action: () => void;
}

export function CommandPaletteDialog() {
  const router = useRouter();
  const { commandPaletteOpen, setCommandPaletteOpen, theme, setTheme, toggleShortcutsModal } =
    useUiStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items: PaletteItem[] = [
    {
      id: 'nav-inbox',
      title: 'Go to Unified Inbox',
      category: 'Navigation',
      icon: Inbox,
      shortcut: 'G I',
      action: () => router.push('/inbox'),
    },
    {
      id: 'nav-contacts',
      title: 'Go to Contacts Directory',
      category: 'Navigation',
      icon: Users,
      shortcut: 'G C',
      action: () => router.push('/contacts'),
    },
    {
      id: 'nav-channels',
      title: 'Go to Connected Platforms',
      category: 'Navigation',
      icon: Radio,
      shortcut: 'G P',
      action: () => router.push('/channels'),
    },
    {
      id: 'nav-ai',
      title: 'Go to AI Agent Console',
      category: 'Navigation',
      icon: Bot,
      shortcut: 'G A',
      action: () => router.push('/ai-agent'),
    },
    {
      id: 'nav-broadcast',
      title: 'Go to Broadcast Campaigns',
      category: 'Navigation',
      icon: Megaphone,
      shortcut: 'G B',
      action: () => router.push('/campaigns'),
    },
    {
      id: 'nav-blast',
      title: 'Go to CSV Blast Dispatcher',
      category: 'Navigation',
      icon: FileSpreadsheet,
      action: () => router.push('/blast'),
    },
    {
      id: 'nav-tickets',
      title: 'Go to Tickets & Workflows',
      category: 'Navigation',
      icon: Ticket,
      shortcut: 'G T',
      action: () => router.push('/tickets'),
    },
    {
      id: 'nav-automations',
      title: 'Go to Automations Engine',
      category: 'Navigation',
      icon: Cpu,
      action: () => router.push('/automations'),
    },
    {
      id: 'nav-templates',
      title: 'Go to Templates & Canned Responses',
      category: 'Navigation',
      icon: FileCode,
      action: () => router.push('/templates'),
    },
    {
      id: 'nav-dashboard',
      title: 'Go to Executive Dashboard',
      category: 'Navigation',
      icon: LayoutDashboard,
      shortcut: 'G D',
      action: () => router.push('/'),
    },
    {
      id: 'nav-reports',
      title: 'Go to Analytics & Reports',
      category: 'Navigation',
      icon: BarChart2,
      shortcut: 'G R',
      action: () => router.push('/analytics'),
    },
    {
      id: 'nav-settings',
      title: 'Go to Workspace Settings',
      category: 'Navigation',
      icon: Settings,
      shortcut: 'G S',
      action: () => router.push('/settings'),
    },
    {
      id: 'act-theme',
      title: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`,
      category: 'Actions',
      icon: theme === 'dark' ? Sun : Moon,
      action: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    },
    {
      id: 'act-shortcuts',
      title: 'View All Keyboard Shortcuts',
      category: 'Actions',
      icon: HelpCircle,
      shortcut: '?',
      action: () => toggleShortcutsModal(),
    },
  ];

  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase()) ||
      (item.shortcut && item.shortcut.toLowerCase().includes(query.toLowerCase())),
  );

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!commandPaletteOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
        setCommandPaletteOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setCommandPaletteOpen(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-n-alpha-black1 p-4 pt-[15vh] backdrop-blur-[4px] animate-in fade-in duration-100"
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-n-weak bg-n-alpha-3 shadow-xl backdrop-blur-[100px] animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-n-weak px-4 py-3">
          <Search className="size-4 shrink-0 text-n-slate-10" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or jump to…"
            aria-label="Search commands"
            className="w-full border-0 bg-transparent text-sm text-n-slate-12 outline-none placeholder:text-n-slate-10 focus-visible:outline-none"
          />
          <kbd className="hidden shrink-0 rounded-md bg-n-alpha-2 px-1.5 py-0.5 font-sans text-xs text-n-slate-11 sm:inline-block">
            Esc
          </kbd>
        </div>

        {/* Search Results */}
        <div className="grid max-h-80 gap-1 overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="p-6 text-center text-sm text-n-slate-11">
              No matching commands or navigation items found.
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    item.action();
                    setCommandPaletteOpen(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-lg p-2 text-left text-sm text-n-slate-12 transition-colors',
                    isSelected && 'bg-n-alpha-2',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Icon className="size-4 shrink-0 text-n-slate-11" />
                    <span className="truncate">{item.title}</span>
                  </span>
                  {item.shortcut && (
                    <kbd className="shrink-0 rounded-md bg-n-alpha-2 px-1.5 py-0.5 font-sans text-xs text-n-slate-11">
                      {item.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div className="flex items-center justify-between border-t border-n-weak px-4 py-2 text-xs text-n-slate-10">
          <span className="flex items-center gap-3">
            <span>↑ ↓ navigate</span>
            <span>↵ select</span>
          </span>
          <span>VYNOR</span>
        </div>
      </div>
    </div>
  );
}
