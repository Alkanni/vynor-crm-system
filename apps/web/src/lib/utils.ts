import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge taught about the VYNOR design scale (globals.css): the custom
 * `text-xxs`/`text-xxxs` sizes, the 420–620 font weights, and the composite
 * typography utilities (`text-heading-1`, `text-label-small`, ...). Without
 * this, `cn('text-heading-1 text-n-slate-12')` would treat both classes as
 * text colors and silently drop the typography class.
 */
const twMerge = extendTailwindMerge<'vynor-typography'>({
  extend: {
    classGroups: {
      'font-size': [{ text: ['xxs', 'xxxs'] }],
      'font-weight': [{ font: ['420', '440', '460', '520', '620'] }],
      'vynor-typography': [
        {
          text: [
            'body-main',
            'body-para',
            'heading-1',
            'heading-2',
            'heading-3',
            'label',
            'label-small',
            'button',
            'button-small',
          ],
        },
      ],
    },
  },
});

/**
 * Merges Tailwind and conditional class names safely (shadcn/ui convention).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
