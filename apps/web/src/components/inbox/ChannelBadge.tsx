import React from 'react';
import { MessageSquare, Mail, Send, Globe, MessageCircle } from 'lucide-react';
import type { ChannelType } from '@vynor/contracts';
import { cn } from '@/lib/utils';

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

interface ChannelBadgeProps {
  channel: ChannelType;
  showLabel?: boolean;
  className?: string;
}

export function ChannelBadge({ channel, showLabel = false, className }: ChannelBadgeProps) {
  const config = {
    WHATSAPP: {
      label: 'WhatsApp',
      icon: MessageCircle,
      bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    },
    INSTAGRAM: {
      label: 'Instagram',
      icon: InstagramIcon,
      bg: 'bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/30',
    },
    TELEGRAM: {
      label: 'Telegram',
      icon: Send,
      bg: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30',
    },
    EMAIL: {
      label: 'Email',
      icon: Mail,
      bg: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
    },
    MESSENGER: {
      label: 'Messenger',
      icon: MessageSquare,
      bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
    },
    LINE: {
      label: 'Line',
      icon: MessageSquare,
      bg: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30',
    },
    WEBCHAT: {
      label: 'Webchat',
      icon: Globe,
      bg: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30',
    },
  }[channel] || {
    label: channel,
    icon: Globe,
    bg: 'bg-muted text-muted-foreground border-border',
  };

  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-xs border px-1.5 py-0.5 text-[10px] font-medium leading-none select-none',
        config.bg,
        className,
      )}
      title={`Channel: ${config.label}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
