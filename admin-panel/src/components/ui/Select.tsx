'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { forwardRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  label: string;
  /** Radix reserves an empty-string value for "no selection". */
  value?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  /**
   * Greys the trigger and blocks interaction. Use it for a dependent select
   * whose options are not meaningful until another field is filled.
   */
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * Select built on Radix, matching the Input field: 48px tall, `radius.md`,
 * `line` border, Persian label above.
 *
 * Radix renders a portal, so `dir` is passed through from the document — the
 * chevron and the check mark must sit on the correct side in RTL.
 */
export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  { label, value, onValueChange, options, placeholder, error, disabled, className },
  ref,
) {
  return (
    <div className={cn('flex w-full flex-col gap-1', className)}>
      <span className="text-caption font-medium text-ink">{label}</span>

      <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectPrimitive.Trigger
          ref={ref}
          aria-invalid={error ? true : undefined}
          className={cn(
            'flex h-12 w-full items-center justify-between gap-2 rounded-md border bg-surface',
            'px-4 text-body text-ink focus:border-brand-primary focus:outline-none focus:ring-2',
            'focus:ring-brand-primary/20 disabled:cursor-not-allowed disabled:opacity-60',
            error ? 'border-error' : 'border-line',
            !value && 'text-ink-muted',
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={4}
            className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-line bg-surface shadow-3"
          >
            <SelectPrimitive.Viewport className="p-1">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className={cn(
                    'flex cursor-pointer select-none items-center justify-between gap-2 rounded-sm',
                    'px-3 py-2 text-body text-ink outline-none',
                    'data-[highlighted]:bg-brand-subtle data-[highlighted]:text-ink',
                    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                  )}
                >
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator>
                    <Check className="h-4 w-4 text-brand-primary" aria-hidden />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>

      {error ? <p className="text-caption text-error">{error}</p> : null}
    </div>
  );
});
