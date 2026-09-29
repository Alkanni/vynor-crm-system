'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { User, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AvatarStatus = 'online' | 'busy' | 'offline';

/** Initials palette from VYNOR `components-next/avatar/Avatar.vue` ([background, text]). */
const AVATAR_COLORS = {
  dark: [
    ['#4B143D', '#FF8DCC'],
    ['#3F220D', '#FFA366'],
    ['#2A2A2A', '#ADB1B8'],
    ['#023B37', '#0BD8B6'],
    ['#27264D', '#A19EFF'],
    ['#1D2E62', '#9EB1FF'],
  ],
  light: [
    ['#FBDCEF', '#C2298A'],
    ['#FFE0BB', '#99543A'],
    ['#E8E8E8', '#60646C'],
    ['#CCF3EA', '#008573'],
    ['#EBEBFE', '#4747C2'],
    ['#E1E9FF', '#3A5BC7'],
  ],
} as const;

const STATUS_CLASSES: Record<AvatarStatus, string> = {
  online: 'bg-n-teal-10',
  busy: 'bg-n-amber-10',
  offline: 'bg-n-slate-10',
};

export function getInitials(name: string): string {
  const words = name
    .replace(/\p{Extended_Pictographic}/gu, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return (words[0] ?? '').charAt(0).toUpperCase();
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();
}

/** Radius approximates 25% of the avatar size, exactly like VYNOR. */
function radiusFor(size: number): string {
  if (size <= 16) return 'rounded';
  if (size <= 24) return 'rounded-md';
  if (size <= 32) return 'rounded-lg';
  if (size <= 48) return 'rounded-xl';
  return 'rounded-2xl';
}

export interface AvatarProps {
  name: string;
  src?: string | null | undefined;
  size?: number | undefined;
  roundedFull?: boolean | undefined;
  status?: AvatarStatus | null | undefined;
  hideOfflineStatus?: boolean | undefined;
  /** Replaces the initials with an icon (e.g. a bot). */
  icon?: LucideIcon | undefined;
  /** Custom badge (e.g. a channel icon) rendered in the status position. */
  badge?: ReactNode | undefined;
  className?: string | undefined;
  title?: string | undefined;
}

/** Port of VYNOR `components-next/avatar/Avatar.vue`. */
export function Avatar({
  name,
  src,
  size = 32,
  roundedFull = false,
  status,
  hideOfflineStatus = false,
  icon: Icon,
  badge,
  className,
  title,
}: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = !!src && failedSrc !== src;
  const hasName = name.trim().length > 0;
  const index = name.length % AVATAR_COLORS.light.length;
  const [lightBg, lightText] = AVATAR_COLORS.light[index] ?? AVATAR_COLORS.light[0];
  const [darkBg, darkText] = AVATAR_COLORS.dark[index] ?? AVATAR_COLORS.dark[0];
  const colorStyle =
    !showImage && hasName
      ? ({
          backgroundColor: lightBg,
          color: lightText,
          '--dark-bg': darkBg,
          '--dark-text': darkText,
        } as CSSProperties)
      : {};

  const radius = roundedFull ? 'rounded-full' : radiusFor(size);
  const badgeSize = Math.max(size * 0.35, 8);
  const badgeStyle: CSSProperties = {
    width: badgeSize,
    height: badgeSize,
    top: size - badgeSize / 1.1,
    left: size - badgeSize / 1.1,
  };
  const showStatus = !!status && !(hideOfflineStatus && status === 'offline');

  return (
    <span
      className={cn('relative z-0 inline-flex shrink-0 align-middle', className)}
      style={{ width: size, height: size }}
      title={title}
    >
      {showStatus && status ? (
        <span
          aria-label={status}
          className={cn(
            'absolute z-20 rounded-full border border-n-slate-3',
            STATUS_CLASSES[status],
          )}
          style={badgeStyle}
        />
      ) : badge ? (
        <span
          className="absolute z-20 flex shrink-0 items-center justify-center rounded-full border border-transparent bg-n-solid-1 text-n-slate-11"
          style={badgeStyle}
        >
          {badge}
        </span>
      ) : null}

      <span
        role="img"
        aria-label={name || 'Avatar'}
        className={cn(
          'relative inline-flex items-center justify-center overflow-hidden font-medium outline outline-1 -outline-offset-1 outline-[rgb(0_0_0_/_0.03)] dark:outline-[rgb(255_255_255_/_0.04)]',
          radius,
          !showImage && hasName && 'dark:!bg-[var(--dark-bg)] dark:!text-[var(--dark-text)]',
          !showImage && !hasName && 'bg-n-slate-3 text-n-slate-11 dark:bg-n-slate-4',
        )}
        style={{ width: size, height: size, ...colorStyle }}
      >
        {showImage ? (
          <img
            src={src ?? undefined}
            alt={name}
            className="size-full object-cover"
            onError={() => setFailedSrc(src ?? null)}
          />
        ) : Icon ? (
          <Icon style={{ width: size / 1.6, height: size / 1.6 }} aria-hidden="true" />
        ) : hasName ? (
          <span className="select-none" style={{ fontSize: Math.min(size / 2.5, 24) }}>
            {getInitials(name)}
          </span>
        ) : (
          <User style={{ width: size / 1.6, height: size / 1.6 }} aria-hidden="true" />
        )}
      </span>
    </span>
  );
}
