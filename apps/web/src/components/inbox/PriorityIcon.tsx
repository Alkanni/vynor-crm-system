import type { PriorityLevel } from './types';
import { cn } from '@/lib/utils';

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  URGENT: 'Urgent',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

/** Bar colors of VYNOR's `i-woot-priority-*` icons (`theme/icons.js`). */
const BARS: Record<PriorityLevel, [string, string, string]> = {
  LOW: ['#ffc53d', 'rgb(var(--slate-5))', 'rgb(var(--slate-5))'],
  MEDIUM: ['#ffc53d', '#ffc53d', 'rgb(var(--slate-5))'],
  HIGH: ['#ffc53d', '#ffc53d', '#ffc53d'],
  URGENT: ['#e5484d', '#e5484d', '#e5484d'],
};

/** Port of VYNOR `ConversationCard/CardPriorityIcon.vue`. */
export function PriorityIcon({
  priority,
  className,
}: {
  priority: PriorityLevel | null | undefined;
  className?: string | undefined;
}) {
  if (!priority) return null;
  const [a, b, c] = BARS[priority];
  const label = `Priority: ${PRIORITY_LABELS[priority]}`;

  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={label}
      className={cn('size-4 shrink-0', className)}
    >
      <title>{label}</title>
      <rect x="4" y="12" width="4" height="8" rx="2" fill={a} />
      <rect x="10" y="8" width="4" height="12" rx="2" fill={b} />
      {priority === 'URGENT' ? (
        <path
          fill={c}
          d="M18 20q-.824 0-1.413-.49Q16 19.021 16 18.333q0-.687.587-1.177.588-.49 1.413-.49.824 0 1.413.49.587.49.587 1.177t-.587 1.177T18 20m0-5q-.824 0-1.413-.49Q16 14.021 16 13.333V6.667q0-.688.587-1.177Q17.176 5 18 5t1.413.49Q20 5.979 20 6.667v6.666q0 .688-.587 1.177Q18.825 15 18 15"
        />
      ) : (
        <rect x="16" y="4" width="4" height="16" rx="2" fill={c} />
      )}
    </svg>
  );
}
