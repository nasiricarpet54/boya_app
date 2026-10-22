import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * Outlined text field.
 *
 * The design system puts the Persian label *above* the field (never floating
 * inside), keeps the value right-aligned in RTL, and puts the helper or error
 * text below the field, right-aligned. Numeric fields render LTR-isolated so
 * phone numbers and OTP digits stay readable.
 */
export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  /** Helper text; replaced by `error` when both are given. */
  hint?: string;
  error?: string;
  /** Renders the value LTR-isolated (phone numbers, OTP, amounts). */
  numeric?: boolean;
  /** Rendered inside the field on the end side (usually an icon button). */
  addon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, numeric = false, addon, className, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedById = `${inputId}-description`;

  return (
    <div className="flex w-full flex-col gap-1">
      <label htmlFor={inputId} className="text-caption font-medium text-ink">
        {label}
      </label>

      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? describedById : undefined}
          className={cn(
            'h-12 w-full rounded-md border bg-surface px-4 text-body text-ink',
            'placeholder:text-ink-muted',
            'focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20',
            'disabled:cursor-not-allowed disabled:bg-line/60 disabled:text-ink-muted',
            error ? 'border-error focus:border-error focus:ring-error/20' : 'border-line',
            // In an RTL document the field is right-aligned by default; only a
            // numeric field needs its direction pinned.
            numeric && 'ltr-nums text-right',
            addon && 'pe-12',
            className,
          )}
          {...props}
        />

        {addon ? (
          <div className="absolute inset-y-0 end-0 flex items-center pe-3">{addon}</div>
        ) : null}
      </div>

      {error || hint ? (
        <p
          id={describedById}
          className={cn('text-caption', error ? 'text-error' : 'text-ink-muted')}
        >
          {error ?? hint}
        </p>
      ) : null}
    </div>
  );
});
