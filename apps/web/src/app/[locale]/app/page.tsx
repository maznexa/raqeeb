'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '../../../lib/api';
import type { Me, Project, Space } from '../../../lib/types';
import { Link } from '../../../i18n/navigation';
import { useTenant } from '../../../components/shell/tenant-context';
import { Skeleton } from '../../../components/task-bits';

export default function AppHome() {
  const t = useTranslations();
  const { slug } = useTenant();

  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api<Me>('/auth/me', { tenant: false }),
  });
  const spaces = useQuery({
    queryKey: ['spaces', slug],
    queryFn: () => api<Space[]>('/spaces'),
    enabled: Boolean(slug),
  });
  const projects = useQuery({
    queryKey: ['projects', slug],
    queryFn: () => api<Project[]>('/projects'),
    enabled: Boolean(slug),
  });

  const firstName = me.data?.account?.displayName?.split(/\s+/)[0];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">
          {t('home.welcome')}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-1 text-sm text-stone-500">{t('home.subtitle')}</p>
      </header>

      {(spaces.isLoading || projects.isLoading) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}

      {projects.data?.length === 0 && (
        <p className="rounded-md border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-sm text-stone-500">
          {t('projects.noProjects')}
        </p>
      )}

      {spaces.data?.map((space) => {
        const spaceProjects = projects.data?.filter((p) => p.spaceId === space.id) ?? [];
        if (spaceProjects.length === 0) return null;
        return (
          <section key={space.id} className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-stone-500">
              <span aria-hidden>{space.icon ?? '◨'}</span>
              {space.name}
              <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-stone-600">
                {spaceProjects.length}
              </span>
            </h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {spaceProjects.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/app/projects/${p.id}`}
                    className="group flex h-full flex-col overflow-hidden rounded-md border border-stone-200 bg-white shadow-card transition-colors hover:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                  >
                    <span
                      aria-hidden
                      className="h-1.5 w-full"
                      style={{ backgroundColor: p.color ?? '#0f766e' }}
                    />
                    <span className="flex flex-1 flex-col gap-1 p-4">
                      <span className="font-semibold text-stone-800 transition-colors group-hover:text-brand-600">
                        {p.name}
                      </span>
                      <span className="font-mono text-xs text-stone-400">{p.key}</span>
                      <span className="mt-2 text-xs font-medium text-brand-500 opacity-0 transition-opacity group-hover:opacity-100">
                        {t('home.openProject')} <span aria-hidden className="inline-block rtl:-scale-x-100">→</span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
