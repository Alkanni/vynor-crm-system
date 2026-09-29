'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import type { ChannelProviderType } from '@vynor/contracts';
import { PLATFORMS, PlatformIcon, getPlatform } from './platforms';
import { FIELD_CLASS } from './ui';
import { cn } from '@/lib/utils';

interface ConnectPlatformModalProps {
  onClose: () => void;
  onConnect: (provider: ChannelProviderType, name: string) => void;
}

/** Mount only while open so every visit starts on the platform grid. */
export function ConnectPlatformModal({ onClose, onConnect }: ConnectPlatformModalProps) {
  const [provider, setProvider] = useState<ChannelProviderType | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const platform = provider ? getPlatform(provider) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-platform-title"
        className="max-h-full w-full max-w-3xl overflow-y-auto rounded-xl bg-[hsl(var(--surface))] p-6 shadow-2xl sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="connect-platform-title" className="text-xl font-semibold text-n-slate-12">
              {platform ? `Connect ${platform.label}` : 'Platform'}
            </h2>
            <p className="mt-1 text-sm text-n-slate-11">
              {platform
                ? 'Give this inbox a name your team will recognise.'
                : 'Select the platform you wish to establish your new inbox'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-n-slate-11 hover:bg-[hsl(var(--muted))]"
          >
            <X className="size-5" />
          </button>
        </div>

        {!platform ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4">
            {PLATFORMS.map((p) => (
              <button
                key={p.provider}
                type="button"
                onClick={() => setProvider(p.provider)}
                className="flex cursor-pointer flex-col items-center justify-center gap-4 rounded-lg border border-[hsl(var(--border))] px-3 py-7 transition-colors hover:border-[#e5484d] hover:bg-[var(--brand-2)]"
              >
                <span className="flex rounded-full bg-[hsl(var(--muted))] p-2">
                  <PlatformIcon provider={p.provider} size="lg" />
                </span>
                <span className="text-center text-xs font-semibold text-n-slate-12">{p.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <form
            className="mt-6 flex flex-col items-center gap-5 text-center"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) onConnect(platform.provider, name.trim());
            }}
          >
            <span className="flex rounded-full bg-[hsl(var(--muted))] p-2">
              <PlatformIcon provider={platform.provider} size="lg" />
            </span>
            <p className="max-w-md text-sm text-n-slate-11">{platform.connectHint}</p>
            <label className="flex w-full max-w-md flex-col gap-2 text-left">
              <span className="text-sm font-medium text-n-slate-12">Inbox name</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Customer Support"
                className={cn(FIELD_CLASS, 'h-11')}
              />
            </label>
            <div className="flex w-full max-w-md items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setProvider(null)}
                className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-n-slate-11 hover:bg-[hsl(var(--muted))]"
              >
                <ArrowLeft className="size-4" />
                All platforms
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                className="h-10 cursor-pointer rounded-lg bg-[#e5484d] px-5 text-sm font-medium text-white transition-colors hover:bg-[#dc3e42] disabled:cursor-not-allowed disabled:bg-[hsl(var(--muted))] disabled:text-[hsl(var(--muted-foreground))]"
              >
                Connect
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
