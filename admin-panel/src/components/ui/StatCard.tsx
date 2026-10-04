import type { LucideIcon } from 'lucide-react';

import { Card } from './Card';
import { cn } from '@/lib/utils/cn';
import { faNumber } from '@/lib/utils/persian';

/**
 * Dashboard figure tile.
 *
 * The value is rendered through `faNumber` so digits are Persian and grouped
 * with `٬`; the caption carries the metric name.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  className,
}: {
  label: string;
  /** `null` renders an em dash rather than a fake zero. */
  value: number | string | null;
  icon: LucideIcon;
  hint?: string;
  className?: string;
}) {
  const display = value === null ? '—' : typeof value === 'number' ? faNumber(value) : value;

  return (
    <Card className={cn('flex items-start gap-4', className)}>
      <span
        aria-hidden
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-subtle text-brand-copper"
      >
        <Icon className="h-5 w-5" />
      </span>

      <div className="min-w-0">
        <p className="text-caption text-ink-muted">{label}</p>
        <p className="mt-1 text-headline font-bold text-ink">{display}</p>
        {hint ? <p className="mt-1 text-overline text-ink-muted">{hint}</p> : null}
      </div>
    </Card>
  );
}
