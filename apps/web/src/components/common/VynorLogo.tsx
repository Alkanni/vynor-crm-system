import React from 'react';
import { cn } from '@/lib/utils';

export interface VynorLogoProps {
  variant?: 'full' | 'mark' | 'wordmark' | undefined;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number | undefined;
  hasUnread?: boolean | undefined;
  className?: string | undefined;
  markClassName?: string | undefined;
  textClassName?: string | undefined;
}

const SIZE_MAP = {
  xs: 16,
  sm: 24,
  md: 32,
  lg: 48,
  xl: 72,
};

/**
 * Authoritative VYNOR circular logomark with folded geometric 'V' and optional unread indicator badge.
 * Color: Brand Red #E5494D with crisp white geometric chevron.
 */
export function VynorLogomark({
  size = 32,
  hasUnread = false,
  className,
}: {
  size?: number | undefined;
  hasUnread?: boolean | undefined;
  className?: string | undefined;
}) {
  return (
    <div
      className={cn('relative inline-flex items-center justify-center shrink-0 select-none', className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Background Brand Red Circle */}
        <circle cx="16" cy="16" r="16" fill="#E5494D" />

        {/* Geometric Folded V Mark */}
        <path
          d="M7.8 8.8H11.8L16 18.2L20.2 8.8H24.2L17.8 23.2H14.2L7.8 8.8Z"
          fill="white"
        />
      </svg>

      {/* Unread Alert Indicator Badge (Golden dot on Brand Red ring) */}
      {hasUnread && (
        <span
          className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full bg-[#E5494D] ring-2 ring-background"
          style={{ width: Math.max(8, size * 0.35), height: Math.max(8, size * 0.35) }}
          title="Unassigned conversations waiting in queue"
        >
          <span
            className="rounded-full bg-[#FFB224]"
            style={{ width: Math.max(4, size * 0.2), height: Math.max(4, size * 0.2) }}
          />
        </span>
      )}
    </div>
  );
}

/**
 * Authoritative VYNOR wordmark with stylized circular typography.
 * Adapts seamlessly between Light Mode (#1C2024) and Dark Mode (#FFFFFF).
 */
export function VynorWordmark({
  size = 20,
  className,
}: {
  size?: number | undefined;
  className?: string | undefined;
}) {
  return (
    <div
      className={cn(
        'font-bold tracking-tight text-foreground select-none inline-flex items-baseline',
        className,
      )}
      style={{ fontSize: size, lineHeight: 1 }}
    >
      <span className="font-extrabold tracking-tight">VYN</span>
      <span className="inline-block relative px-[0.5px]">
        {/* Stylized rounded O */}
        <svg
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="inline-block align-baseline"
          style={{ width: size * 0.85, height: size * 0.85, marginBottom: size * -0.05 }}
        >
          <rect
            x="2.5"
            y="2.5"
            width="15"
            height="15"
            rx="7.5"
            stroke="currentColor"
            strokeWidth="3.4"
          />
        </svg>
      </span>
      <span className="font-extrabold tracking-tight">R</span>
    </div>
  );
}

/**
 * Master VYNOR Logo component with variant switching.
 */
export function VynorLogo({
  variant = 'full',
  size = 'md',
  hasUnread = false,
  className,
  markClassName,
  textClassName,
}: VynorLogoProps) {
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size];

  if (variant === 'mark') {
    return (
      <VynorLogomark
        size={pixelSize}
        hasUnread={hasUnread}
        className={cn(className, markClassName)}
      />
    );
  }

  if (variant === 'wordmark') {
    return (
      <VynorWordmark
        size={pixelSize * 0.65}
        className={cn(className, textClassName)}
      />
    );
  }

  return (
    <div
      className={cn('inline-flex items-center gap-2 select-none', className)}
      aria-label="VYNOR CRM"
    >
      <VynorLogomark
        size={pixelSize}
        hasUnread={hasUnread}
        className={markClassName}
      />
      <VynorWordmark
        size={pixelSize * 0.68}
        className={textClassName}
      />
    </div>
  );
}
