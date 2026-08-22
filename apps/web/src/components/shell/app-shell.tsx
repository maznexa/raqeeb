'use client';

import { useState, type ReactNode } from 'react';
import { TenantProvider } from './tenant-context';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

/** ClickUp-style shell: dark sidebar + light content, shared by all /app routes. */
export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <TenantProvider>
      <div className="flex h-dvh overflow-hidden bg-stone-50">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="scroll-slim min-h-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </TenantProvider>
  );
}
