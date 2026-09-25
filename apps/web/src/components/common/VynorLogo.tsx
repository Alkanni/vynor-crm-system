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
 * Authoritative VYNOR circular logomark with clean rounded chevron 'V' and optional unread indicator badge.
 * Extracted directly from VYNOR/public/brand-assets/logo.svg and VYNOR/app/javascript/dashboard/components-next/icon/Logo.vue.
 * Color: Brand Red #E5484D with crisp white rounded chevron.
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
      className={cn(
        'relative inline-flex items-center justify-center shrink-0 select-none',
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 220 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Background Brand Red Circle */}
        <circle cx="110" cy="110" r="110" fill="#E5484D" />

        {/* Authentic VYNOR Rounded 'V' Chevron */}
        <path
          d="M59 63L110 160L161 63"
          stroke="white"
          strokeWidth="30"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Unread Alert Indicator Badge (Golden dot on Brand Red ring) */}
      {hasUnread && (
        <span
          className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full bg-[#E5484D] ring-2 ring-background"
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
 * Authoritative VYNOR wordmark with authentic vector geometry from VYNOR/public/brand-assets/logo.svg.
 * Adapts seamlessly to current text color (light #1C2024 / dark #FFFFFF) via currentColor.
 */
export function VynorWordmark({
  size = 20,
  className,
}: {
  size?: number | undefined;
  className?: string | undefined;
}) {
  // Original wordmark bounding box is ~660w x 140h (ratio ~ 4.7:1)
  const width = size * 4.7;
  const height = size;

  return (
    <svg
      viewBox="280 35 660 150"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="VYNOR"
      className={cn('inline-block select-none text-foreground shrink-0', className)}
      style={{ width, height }}
    >
      <g
        stroke="currentColor"
        strokeWidth="26"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {/* Letter V */}
        <path d="M300 50L354 170L408 50" />
        {/* Letter Y */}
        <path d="M436 50L490 116L544 50" />
        <path d="M490 116V170" />
        {/* Letter N */}
        <path d="M572 170V50L668 170V50" />
        {/* Letter O */}
        <ellipse cx="750" cy="110" rx="41" ry="60" />
        {/* Letter R */}
        <path d="M832 170V50" />
        <path d="M832 50H880A30 30 0 0 1 880 110H832" />
        <path d="M876 110L928 170" />
      </g>
    </svg>
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
    return <VynorWordmark size={pixelSize * 0.65} className={cn(className, textClassName)} />;
  }

  return (
    <div
      className={cn('inline-flex items-center gap-2.5 select-none', className)}
      aria-label="VYNOR CRM"
    >
      <VynorLogomark size={pixelSize} hasUnread={hasUnread} className={markClassName} />
      <VynorWordmark size={pixelSize * 0.58} className={textClassName} />
    </div>
  );
}
