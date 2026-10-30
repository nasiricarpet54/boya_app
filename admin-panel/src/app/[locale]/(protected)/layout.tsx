'use client';
import { useState, type ReactNode } from 'react';

import { RequireAuth } from '@/components/auth/RequireAuth';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';

/**
 * Shell for every authenticated route.
 */
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <RequireAuth>
      <div className="flex h-screen overflow-hidden bg-cream">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenuClick={() => setIsSidebarOpen(true)} />

          <main className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </RequireAuth>
  );
}