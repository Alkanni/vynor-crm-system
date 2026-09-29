import React from 'react';
import { Globe, Mail, MessageCircle, MessageSquare, Send } from 'lucide-react';
import type { ChannelType } from '@vynor/contracts';
import { cn } from '@/lib/utils';

function InstagramIcon({ className }: { className?: string | undefined }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

type IconComponent = React.ComponentType<{ className?: string | undefined }>;

export const CHANNEL_META: Record<string, { label: string; icon: IconComponent }> = {
  WHATSAPP: { label: 'WhatsApp', icon: MessageCircle },
  INSTAGRAM: { label: 'Instagram', icon: InstagramIcon },
  TELEGRAM: { label: 'Telegram', icon: Send },
  EMAIL: { label: 'Email', icon: Mail },
  MESSENGER: { label: 'Messenger', icon: MessageSquare },
  LINE: { label: 'Line', icon: MessageSquare },
  WEBCHAT: { label: 'Webchat', icon: Globe },
};

export function channelMeta(channel: ChannelType | string) {
  return CHANNEL_META[channel] ?? { label: String(channel), icon: Globe };
}

interface ChannelBadgeProps {
  channel: ChannelType;
  /** Inbox-name pill (icon + label) instead of the round icon. */
  showLabel?: boolean | undefined;
  className?: string | undefined;
}

/**
 * Inbox/channel indicator. Default: VYNOR ConversationCard inbox icon —
 * `rounded-full bg-n-alpha-2 size-5` with a `size-3 text-n-slate-11` glyph.
 * With `showLabel`: VYNOR `InboxName` pill.
 */
export function ChannelBadge({ channel, showLabel = false, className }: ChannelBadgeProps) {
  const { label, icon: Icon } = channelMeta(channel);

  if (showLabel) {
    return (
      <span
        title={`Inbox: ${label}`}
        className={cn(
          'inline-flex h-6 shrink-0 select-none items-center gap-1.5 rounded-md bg-n-alpha-2 px-2 text-xs text-n-slate-11',
          className,
        )}
      >
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
    );
  }

  return (
    <span
      title={label}
      aria-label={`Inbox: ${label}`}
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-full bg-n-alpha-2',
        className,
      )}
    >
      <Icon className="size-3 shrink-0 text-n-slate-11" />
    </span>
  );
}
