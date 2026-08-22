'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, session } from '../../lib/api';
import type { MyTenant } from '../../lib/types';

interface TenantState {
  slug: string | null;
  tenants: MyTenant[] | undefined;
  current: MyTenant | undefined;
  switchTenant: (slug: string) => void;
}

const TenantContext = createContext<TenantState | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  // localStorage is read only after mount — SSG markup and first client render
  // must match (React #418), so tenant selection lives in state, not in render.
  const [slug, setSlug] = useState<string | null>(null);

  const tenants = useQuery({
    queryKey: ['me/tenants'],
    queryFn: () => api<MyTenant[]>('/me/tenants', { tenant: false }),
  });

  useEffect(() => {
    if (session.tenantSlug) {
      setSlug(session.tenantSlug);
    } else if (tenants.data?.length) {
      session.setTenant(tenants.data[0]!.slug);
      setSlug(tenants.data[0]!.slug);
    }
  }, [tenants.data]);

  const switchTenant = (next: string) => {
    session.setTenant(next);
    setSlug(next);
    // Remove (not just invalidate) cached data: invalidated queries keep serving the
    // previous tenant's rows until their refetch lands — a brief cross-tenant flash.
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me/tenants' });
  };

  return (
    <TenantContext.Provider
      value={{
        slug,
        tenants: tenants.data,
        current: tenants.data?.find((t) => t.slug === slug),
        switchTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantState {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used inside TenantProvider');
  return ctx;
}
