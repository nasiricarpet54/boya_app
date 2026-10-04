'use client';

import * as ToastPrimitive from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/utils/cn';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastItem extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Must be called under `<ToastProvider>`; throws rather than no-op'ing. */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }

  return context;
}

const VARIANT_ACCENT: Record<ToastVariant, string> = {
  success: 'before:bg-success',
  error: 'before:bg-error',
  info: 'before:bg-info',
};

/**
 * Toast host built on Radix.
 *
 * The accent bar keeps the semantic meaning the design system assigns to each
 * colour instead of replacing it with the brand hue.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Cap the stack: a refetch loop must not bury the page under toasts.
    setItems((current) => [...current.slice(-2), { ...options, id }]);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="left" duration={5000}>
        {children}

        {items.map((item) => (
          <ToastPrimitive.Root
            key={item.id}
            onOpenChange={(open) => {
              if (!open) dismiss(item.id);
            }}
            className={cn(
              'relative overflow-hidden rounded-lg bg-surface p-4 pe-12 shadow-2',
              'before:absolute before:inset-y-0 before:start-0 before:w-1',
              VARIANT_ACCENT[item.variant ?? 'info'],
            )}
          >
            <ToastPrimitive.Title className="text-body font-semibold text-ink">
              {item.title}
            </ToastPrimitive.Title>

            {item.description ? (
              <ToastPrimitive.Description className="mt-1 text-caption text-ink-muted">
                {item.description}
              </ToastPrimitive.Description>
            ) : null}

            <ToastPrimitive.Close
              aria-label="بستن"
              className="absolute end-3 top-3 rounded-sm p-1 text-ink-muted transition hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}

        <ToastPrimitive.Viewport className="fixed bottom-4 start-4 z-50 flex w-80 flex-col gap-2 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
