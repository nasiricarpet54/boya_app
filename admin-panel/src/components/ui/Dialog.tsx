'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** Modal sheet on `surface` with `shadow.3` and `radius.lg`, per the design system. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40 transition-opacity data-[state=open]:opacity-100 data-[state=closed]:opacity-0" />

        <DialogPrimitive.Content
          className={cn(
            'fixed inset-x-4 top-1/2 z-50 mx-auto w-auto max-w-lg -translate-y-1/2',
            'rounded-lg bg-surface p-6 shadow-3',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="text-title font-semibold text-ink">
                {title}
              </DialogPrimitive.Title>

              {description ? (
                <DialogPrimitive.Description className="mt-1 text-caption text-ink-muted">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>

            <DialogPrimitive.Close
              aria-label="بستن"
              className="rounded-sm p-1 text-ink-muted transition hover:text-ink"
            >
              <X className="h-5 w-5" aria-hidden />
            </DialogPrimitive.Close>
          </div>

          {children ? <div className="mt-4">{children}</div> : null}

          {footer ? <div className="mt-6 flex justify-start gap-2">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
