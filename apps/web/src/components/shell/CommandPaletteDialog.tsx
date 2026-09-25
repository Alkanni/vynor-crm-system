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
      action: () => {
        const nextTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(nextTheme);
        if (typeof document !== 'undefined') {
          if (nextTheme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      },
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
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[15vh] backdrop-blur-xs"
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        className="w-full max-w-xl rounded-md border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-border px-3.5 py-2.5 bg-background">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or jump to module..."
            className="w-full bg-transparent text-sm text-foreground outline-hidden placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-block rounded-xs border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Search Results */}
        <div className="max-h-80 overflow-y-auto p-1.5 divide-y divide-border/20">
          {filteredItems.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
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
                    'flex w-full items-center justify-between rounded-xs px-2.5 py-2 text-left text-xs transition-colors',
                    isSelected
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-foreground hover:bg-muted',
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0',
                        isSelected ? 'text-primary-foreground' : 'text-muted-foreground',
                      )}
                    />
                    <span>{item.title}</span>
                  </div>
                  {item.shortcut && (
                    <kbd
                      className={cn(
                        'rounded-xs border px-1.5 py-0.5 font-mono text-[10px]',
                        isSelected
                          ? 'border-primary-foreground/30 bg-primary-foreground/20 text-primary-foreground'
                          : 'border-border bg-muted text-muted-foreground',
                      )}
                    >
                      {item.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div className="flex items-center justify-between border-t border-border bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono">↑</kbd> <kbd className="font-mono">↓</kbd> navigate
            </span>
            <span>
              <kbd className="font-mono">↵</kbd> select
            </span>
          </div>
          <span>VYNOR Command Bar</span>
        </div>
      </div>
    </div>
  );
}
