'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

/**
 * TanStack Query host for the whole panel.
 *
 * The client is created inside `useState` so each browser session gets one
 * cache; building it at module scope would share it across requests during SSR.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Admin figures move slowly and the panel is a back office: a
            // 30s window avoids refetching the approval badge on every mount
            // without leaving the queue stale for long.
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
