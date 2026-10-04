import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

/** `surface` background, `radius.lg`, `shadow.1`, 16px padding. */
export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('rounded-lg bg-surface p-4 shadow-1', className)}>{children}</div>;
}

export function CardTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <h2 className={cn('text-title font-semibold text-ink', className)}>{children}</h2>;
}

export function CardCaption({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cn('text-caption text-ink-muted', className)}>{children}</p>;
}
