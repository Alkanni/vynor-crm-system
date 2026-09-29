import { forwardRef, isValidElement, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from './Spinner';

export type ButtonVariant = 'solid' | 'faded' | 'outline' | 'ghost' | 'link';
export type ButtonColor = 'blue' | 'ruby' | 'amber' | 'slate' | 'teal';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';
export type ButtonJustify = 'start' | 'center' | 'end';

/**
 * Style contract ported 1:1 from VYNOR `components-next/button/Button.vue`.
 * `blue` is the VYNOR primary color and carries the brand red (#E5484D).
 */
const COLORS: Record<ButtonColor, Record<ButtonVariant, string>> = {
  blue: {
    solid:
      'bg-n-brand text-white hover:enabled:brightness-110 focus-visible:brightness-110 outline-transparent',
    faded:
      'bg-n-brand/10 text-n-blue-11 hover:enabled:bg-n-brand/20 focus-visible:bg-n-brand/20 outline-transparent',
    outline: 'text-n-blue-11 outline-n-brand',
    ghost:
      'text-n-blue-11 hover:enabled:bg-n-alpha-2 focus-visible:bg-n-alpha-2 outline-transparent',
    link: 'text-n-blue-11 hover:enabled:underline focus-visible:underline outline-transparent',
  },
  ruby: {
    solid:
      'bg-n-ruby-9 text-white hover:enabled:bg-n-ruby-10 focus-visible:bg-n-ruby-10 outline-transparent',
    faded:
      'bg-n-ruby-9/10 text-n-ruby-11 hover:enabled:bg-n-ruby-9/20 focus-visible:bg-n-ruby-9/20 outline-transparent',
    outline:
      'text-n-ruby-11 hover:enabled:bg-n-ruby-9/10 focus-visible:bg-n-ruby-9/10 outline-n-ruby-8',
    ghost:
      'text-n-ruby-11 hover:enabled:bg-n-alpha-2 focus-visible:bg-n-alpha-2 outline-transparent',
    link: 'text-n-ruby-9 dark:text-n-ruby-11 hover:enabled:underline focus-visible:underline outline-transparent',
  },
  amber: {
    solid:
      'bg-n-amber-9 text-n-amber-12 dark:text-n-amber-3 hover:enabled:bg-n-amber-10 focus-visible:bg-n-amber-10 outline-transparent',
    faded:
      'bg-n-amber-9/10 text-n-slate-12 hover:enabled:bg-n-amber-9/20 focus-visible:bg-n-amber-9/20 outline-transparent',
    outline:
      'text-n-amber-11 hover:enabled:bg-n-amber-9/10 focus-visible:bg-n-amber-9/10 outline-n-amber-9',
    ghost:
      'text-n-amber-9 hover:enabled:bg-n-alpha-2 focus-visible:bg-n-alpha-2 outline-transparent',
    link: 'text-n-amber-9 hover:enabled:underline focus-visible:underline outline-transparent',
  },
  slate: {
    solid:
      'bg-n-button-color dark:hover:enabled:bg-n-solid-2 dark:focus-visible:bg-n-solid-2 hover:enabled:bg-n-alpha-2 focus-visible:bg-n-alpha-2 text-n-slate-12 outline-n-container',
    faded:
      'bg-n-slate-9/10 text-n-slate-12 hover:enabled:bg-n-slate-9/20 focus-visible:bg-n-slate-9/20 outline-transparent',
    outline:
      'text-n-slate-11 outline-n-strong hover:enabled:bg-n-slate-9/10 focus-visible:bg-n-slate-9/10',
    ghost:
      'text-n-slate-12 hover:enabled:bg-n-alpha-2 focus-visible:bg-n-alpha-2 outline-transparent',
    link: 'text-n-slate-11 hover:enabled:text-n-slate-12 focus-visible:text-n-slate-12 hover:enabled:underline focus-visible:underline outline-transparent',
  },
  teal: {
    solid:
      'bg-n-teal-9 text-white hover:enabled:bg-n-teal-10 focus-visible:bg-n-teal-10 outline-transparent',
    faded:
      'bg-n-teal-9/10 text-n-teal-11 hover:enabled:bg-n-teal-9/20 focus-visible:bg-n-teal-9/20 outline-transparent',
    outline:
      'text-n-teal-11 hover:enabled:bg-n-teal-9/10 focus-visible:bg-n-teal-9/10 outline-n-teal-9',
    ghost:
      'text-n-teal-9 hover:enabled:bg-n-alpha-2 focus-visible:bg-n-alpha-2 outline-transparent',
    link: 'text-n-teal-9 hover:enabled:underline focus-visible:underline outline-transparent',
  },
};

const SIZES = {
  regular: { xs: 'h-6 px-2', sm: 'h-8 px-3', md: 'h-10 px-4', lg: 'h-12 px-5' },
  iconOnly: { xs: 'size-6 p-0', sm: 'size-8 p-0', md: 'size-10 p-0', lg: 'size-12 p-0' },
} as const;

const FONT_SIZES: Record<ButtonSize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-sm font-medium',
  lg: 'text-base',
};

const CLICK_ANIMATION: Record<ButtonSize, string> = {
  xs: 'active:enabled:scale-[0.97]',
  sm: 'active:enabled:scale-[0.97]',
  md: 'active:enabled:scale-[0.98]',
  lg: 'active:enabled:scale-[0.98]',
};

const ICON_SIZES: Record<ButtonSize, string> = {
  xs: 'size-3.5',
  sm: 'size-4',
  md: 'size-4',
  lg: 'size-5',
};

const JUSTIFY: Record<ButtonJustify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
};

const BASE =
  'inline-flex items-center min-w-0 gap-2 transition-all duration-100 ease-out border-0 rounded-lg outline outline-1 disabled:opacity-50 disabled:cursor-not-allowed';

export interface ButtonStyleOptions {
  variant?: ButtonVariant | undefined;
  color?: ButtonColor | undefined;
  size?: ButtonSize | undefined;
  justify?: ButtonJustify | undefined;
  iconOnly?: boolean | undefined;
  noAnimation?: boolean | undefined;
}

/** Class list for anything that should look like a VYNOR button (e.g. a Next `<Link>`). */
export function buttonVariants({
  variant = 'solid',
  color = 'blue',
  size = 'md',
  justify = 'center',
  iconOnly = false,
  noAnimation = false,
}: ButtonStyleOptions = {}): string {
  const isLink = variant === 'link';
  return cn(
    BASE,
    COLORS[color][variant],
    isLink ? 'p-0 font-medium underline-offset-2' : SIZES[iconOnly ? 'iconOnly' : 'regular'][size],
    FONT_SIZES[size],
    !noAnimation && CLICK_ANIMATION[size],
    JUSTIFY[justify],
  );
}

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'>, ButtonStyleOptions {
  /** A lucide icon component or any rendered icon node. */
  icon?: LucideIcon | ReactNode | undefined;
  trailingIcon?: boolean | undefined;
  isLoading?: boolean | undefined;
  label?: ReactNode | undefined;
}

function renderIcon(icon: ButtonProps['icon'], size: ButtonSize): ReactNode {
  if (!icon) return null;
  if (isValidElement(icon)) return icon;
  if (
    typeof icon === 'function' ||
    (typeof icon === 'object' && icon !== null && '$$typeof' in icon)
  ) {
    const IconComponent = icon as LucideIcon;
    return <IconComponent className={cn('shrink-0', ICON_SIZES[size])} aria-hidden="true" />;
  }
  return icon as ReactNode;
}

/** Port of VYNOR `components-next/button/Button.vue`. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'solid',
    color = 'blue',
    size = 'md',
    justify = 'center',
    icon,
    trailingIcon = false,
    isLoading = false,
    noAnimation = false,
    label,
    iconOnly,
    className,
    children,
    type = 'button',
    ...props
  },
  ref,
) {
  const hasContent = label !== undefined && label !== null && label !== '' ? true : !!children;
  const isIconOnly = iconOnly ?? !hasContent;

  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        buttonVariants({ variant, color, size, justify, iconOnly: isIconOnly, noAnimation }),
        trailingIcon && !isIconOnly && 'flex-row-reverse',
        className,
      )}
      {...props}
    >
      {isLoading ? <Spinner size={size === 'xs' ? 14 : 18} /> : renderIcon(icon, size)}
      {label !== undefined && label !== null && label !== '' ? (
        <span className="min-w-0 truncate">{label}</span>
      ) : (
        children
      )}
    </button>
  );
});
