'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api, session } from '../../../lib/api';
import { Link, useRouter } from '../../../i18n/navigation';
import { LocaleSwitcher } from '../../../components/locale-switcher';

interface MyTenant {
  tenantId: string;
  name: string;
  slug: string;
  role: string;
}
interface Project {
  id: string;
  name: string;
  key: string;
  color: string | null;
  clientId: string | null;
}

export default function AppHome() {
  const t = useTranslations();
  const router = useRouter();
  const qc = useQueryClient();

  // localStorage is read only after mount — SSG markup and first client render
  // must match (React #418), so tenant selection lives in state, not in render.
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const tenants = useQuery({
    queryKey: ['me/tenants'],
    queryFn: () => api<MyTenant[]>('/me/tenants', { tenant: false }),
  });

  useEffect(() => {
    if (session.tenantSlug) {
      setSelectedSlug(session.tenantSlug);
    } else if (tenants.data?.length) {
      session.setTenant(tenants.data[0]!.slug);
      setSelectedSlug(tenants.data[0]!.slug);
    }
  }, [tenants.data]);

  const projects = useQuery({
    queryKey: ['projects', selectedSlug],
    queryFn: () => api<Project[]>('/projects'),
    enabled: Boolean(selectedSlug),
  });

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-8 flex items-center justify-between border-b border-stone-200 pb-4">
        <h1 className="text-xl font-bold text-brand-700">{t('common.appName')}</h1>
        <div className="flex items-center gap-4">
          <LocaleSwitcher />
          <button
            onClick={() => {
              session.clear();
              router.push('/login');
            }}
            className="text-sm text-stone-500 hover:text-stone-800"
          >
            {t('auth.signOut')}
          </button>
        </div>
      </header>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
          {t('nav.switchTenant')}
        </h2>
        <div className="flex flex-wrap gap-2">
          {tenants.data?.map((tn) => (
            <button
              key={tn.tenantId}
              onClick={() => {
                session.setTenant(tn.slug);
                setSelectedSlug(tn.slug);
                void qc.invalidateQueries();
              }}
              className={
                tn.slug === selectedSlug
                  ? 'rounded-full bg-brand-500 px-3 py-1 text-sm font-semibold text-white'
                  : 'rounded-full border border-stone-300 px-3 py-1 text-sm hover:border-brand-500'
              }
            >
              {tn.name}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
          {t('nav.projects')}
        </h2>
        {projects.isLoading && <p className="text-stone-500">{t('common.loading')}</p>}
        {projects.data?.length === 0 && (
          <p className="text-stone-500">{t('projects.noProjects')}</p>
        )}
        <ul className="flex flex-col gap-2">
          {projects.data?.map((p) => (
            <li key={p.id}>
              <Link
                href={`/app/projects/${p.id}`}
                className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-3 hover:border-brand-500"
              >
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: p.color ?? '#0f766e' }}
                  aria-hidden
                />
                <span className="font-medium">{p.name}</span>
                <span className="ms-auto text-xs font-mono text-stone-400">{p.key}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
