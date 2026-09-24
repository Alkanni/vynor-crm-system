import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind and conditional class names safely (shadcn/ui convention).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
