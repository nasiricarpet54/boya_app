import type { ReactNode } from 'react';

import { RequireAuth } from '@/components/auth/RequireAuth';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';

/**
 * Shell for every authenticated route.
 *
 * `flex` in an RTL document puts the first child on the right, which is where
 * the sidebar belongs; the content column then takes the rest of the width.
 */
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <div className="flex h-screen overflow-hidden bg-cream">
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <main className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </RequireAuth>
  );
}
