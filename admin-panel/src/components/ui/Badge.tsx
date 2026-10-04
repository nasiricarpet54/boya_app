import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'error' | 'info';

/**
 * Status pill on `radius.full`.
 *
 * Tinted background plus text in the same semantic colour: the design system
 * rejects white text on the light values (`success`, `warning`) for contrast.
 */
const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-line/60 text-ink-muted',
  brand: 'bg-brand-subtle text-brand-copper',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-error/10 text-error',
  info: 'bg-info/10 text-info',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-overline font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
