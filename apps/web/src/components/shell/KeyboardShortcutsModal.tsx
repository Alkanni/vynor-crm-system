'use client';

import { X } from 'lucide-react';
import { useUiStore } from '@/lib/store/ui-store';
import { Button, Dialog } from '@/components/ui';

const SHORTCUT_SECTIONS = [
  {
    title: 'Unified Inbox',
    items: [
      { key: 'J', desc: 'Select next conversation' },
      { key: 'K', desc: 'Select previous conversation' },
      { key: 'C', desc: 'Focus the reply box' },
      { key: 'A', desc: 'Claim conversation' },
      { key: 'E', desc: 'Resolve conversation' },
      { key: 'Alt + N', desc: 'Toggle Reply / Private Note' },
      { key: 'Ctrl + Enter', desc: 'Send reply or add note' },
      { key: '/', desc: 'Insert canned response' },
      { key: 'Esc', desc: 'Blur reply box / close popover' },
    ],
  },
  {
    title: 'Navigation',
    items: [
      { key: 'G then I', desc: 'Inbox' },
      { key: 'G then C', desc: 'Contacts' },
      { key: 'G then P', desc: 'Channels' },
      { key: 'G then A', desc: 'AI Agent' },
      { key: 'G then B', desc: 'Broadcast' },
      { key: 'G then T', desc: 'Tickets' },
      { key: 'G then D', desc: 'Dashboard' },
      { key: 'G then R', desc: 'Reports' },
      { key: 'G then S', desc: 'Settings' },
    ],
  },
  {
    title: 'General',
    items: [
      { key: 'Ctrl + K', desc: 'Search / command bar' },
      { key: '?', desc: 'Keyboard shortcuts' },
      { key: '[', desc: 'Collapse / expand sidebar' },
      { key: ']', desc: 'Toggle contact panel' },
    ],
  },
];

/** Keyboard shortcut cheatsheet (VYNOR `KeyboardShortcutModal`) on the Dialog primitive. */
export function KeyboardShortcutsModal() {
  const { shortcutsModalOpen, setShortcutsModalOpen } = useUiStore();
  const close = () => setShortcutsModalOpen(false);

  return (
    <Dialog
      open={shortcutsModalOpen}
      onClose={close}
      width="2xl"
      footer={null}
      title={
        <span className="flex items-center justify-between gap-2">
          <span>Keyboard shortcuts</span>
          <Button
            variant="ghost"
            color="slate"
            size="sm"
            icon={X}
            aria-label="Close keyboard shortcuts"
            onClick={close}
          />
        </span>
      }
    >
      <div className="-mt-2 flex max-h-[65vh] flex-col gap-6 overflow-y-auto pr-1">
        {SHORTCUT_SECTIONS.map((section) => (
          <section key={section.title} className="flex flex-col gap-2">
            <h4 className="text-xs font-medium tracking-[0.2px] text-n-slate-10">
              {section.title}
            </h4>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {section.items.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-n-alpha-1"
                >
                  <span className="text-sm text-n-slate-11">{item.desc}</span>
                  <kbd className="shrink-0 rounded-md bg-n-alpha-2 px-1.5 py-0.5 font-sans text-xs font-medium text-n-slate-12 outline outline-1 -outline-offset-1 outline-n-weak">
                    {item.key}
                  </kbd>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
