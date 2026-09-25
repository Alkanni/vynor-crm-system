'use client';

import { X, Keyboard } from 'lucide-react';
import { useUiStore } from '@/lib/store/ui-store';

export function KeyboardShortcutsModal() {
  const { shortcutsModalOpen, setShortcutsModalOpen } = useUiStore();

  if (!shortcutsModalOpen) return null;

  const shortcutSections = [
    {
      title: 'Unified Inbox Operational Loop (Section 41)',
      items: [
        { key: 'J', desc: 'Select next conversation in active queue' },
        { key: 'K', desc: 'Select previous conversation in active queue' },
        { key: 'C', desc: 'Focus Message Composer input' },
        { key: 'A', desc: 'Claim conversation (Take ownership)' },
        { key: 'E', desc: 'Complete / Resolve conversation' },
        { key: 'Alt + N', desc: 'Toggle Internal Note mode (Team only)' },
        { key: 'Ctrl + Enter', desc: 'Send customer reply or add note' },
        { key: '/', desc: 'Trigger Canned Response / Template popover' },
        { key: 'Esc', desc: 'Blur composer / Close popover' },
      ],
    },
    {
      title: 'Global Navigation Chords (Section 11)',
      items: [
        { key: 'G then I', desc: 'Jump to Unified Inbox (/inbox)' },
        { key: 'G then C', desc: 'Jump to Contacts Directory (/contacts)' },
        { key: 'G then P', desc: 'Jump to Connected Platforms (/channels)' },
        { key: 'G then A', desc: 'Jump to AI Agent Console (/ai-agent)' },
        { key: 'G then B', desc: 'Jump to Broadcast Campaigns (/campaigns)' },
        { key: 'G then T', desc: 'Jump to Tickets & Workflows (/tickets)' },
        { key: 'G then D', desc: 'Jump to Executive Dashboard (/)' },
        { key: 'G then R', desc: 'Jump to Reports & Analytics (/analytics)' },
        { key: 'G then S', desc: 'Jump to Workspace Settings (/settings)' },
      ],
    },
    {
      title: 'System & Command Palette',
      items: [
        { key: 'Ctrl + K / ⌘K', desc: 'Open Global Command Palette' },
        { key: '?', desc: 'Toggle this Keyboard Shortcuts Cheatsheet' },
        { key: '[', desc: 'Toggle Navigation Rail Collapse/Expand' },
        { key: ']', desc: 'Toggle Customer Context Panel' },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      onClick={() => setShortcutsModalOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-modal-title"
        className="w-full max-w-2xl rounded-md border border-border bg-card p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" />
            <h2 id="shortcuts-modal-title" className="text-sm font-semibold text-foreground">
              Keyboard Productivity Cheatsheet
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShortcutsModalOpen(false)}
            aria-label="Close keyboard shortcuts modal"
            className="rounded-xs p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Shortcut Groups */}
        <div className="mt-4 max-h-[65vh] overflow-y-auto space-y-5 pr-1 text-xs">
          {shortcutSections.map((sec) => (
            <div key={sec.title} className="space-y-2">
              <h3 className="font-semibold text-muted-foreground tracking-wider uppercase text-[11px]">
                {sec.title}
              </h3>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {sec.items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between rounded-xs border border-border/60 bg-surface px-2.5 py-1.5"
                  >
                    <span className="text-muted-foreground">{item.desc}</span>
                    <kbd className="ml-2 shrink-0 rounded-xs border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-4 border-t border-border pt-3 text-right">
          <button
            type="button"
            onClick={() => setShortcutsModalOpen(false)}
            className="rounded-xs bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
          >
            Close (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
