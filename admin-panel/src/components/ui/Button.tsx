import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * Button, per the design system: 48px tall, `radius.md`, weight-600 label,
 * 16px horizontal padding. Disabled filled buttons use the `line`/`ink-muted`
 * pair; the transparent variants only drop to 40% opacity.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-copper text-white hover:bg-brand-copper-hover active:bg-brand-copper-pressed disabled:bg-line disabled:text-ink-muted',
  secondary:
    'border border-brand-copper bg-transparent text-ink hover:bg-brand-subtle active:bg-brand-subtle disabled:opacity-40',
  ghost:
    'bg-transparent text-brand-copper hover:bg-brand-subtle active:bg-brand-subtle disabled:opacity-40',
  danger: 'bg-error text-white hover:opacity-90 active:opacity-80 disabled:opacity-40',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-caption',
  md: 'h-12 px-4 text-body',
  lg: 'h-14 px-6 text-body',
};

/** Shared class builder, so `next/link` can wear the same styles. */
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-md font-semibold',
    'transition-colors disabled:cursor-not-allowed',
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, fullWidth, className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      // Defaulted so a button inside a form does not submit by accident.
      type={type}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...props}
    />
  );
});
