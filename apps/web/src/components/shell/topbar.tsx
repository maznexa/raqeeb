'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api, session } from '../../lib/api';
import { avatarColor, initialsOf } from '../../lib/format';
import type { Me, Project, Space } from '../../lib/types';
import { Link, usePathname, useRouter } from '../../i18n/navigation';
import { LocaleSwitcher } from '../locale-switcher';
import { useTenant } from './tenant-context';

/** Breadcrumb derived from the pathname + already-cached container queries. */
function Breadcrumb() {
  const t = useTranslations();
  const pathname = usePathname();
  const { slug } = useTenant();

  const projects = useQuery({
    queryKey: ['projects', slug],
    queryFn: () => api<Project[]>('/projects'),
    enabled: Boolean(slug),
  });
  const spaces = useQuery({
    queryKey: ['spaces', slug],
    queryFn: () => api<Space[]>('/spaces'),
    enabled: Boolean(slug),
  });

  const crumbs: { label: string; href?: string }[] = [{ label: t('nav.home'), href: '/app' }];
  const match = pathname.match(/^\/app\/projects\/([^/?]+)/);
  if (match) {
    const project = projects.data?.find((p) => p.id === match[1]);
    const space = spaces.data?.find((s) => s.id === project?.spaceId);
    if (space) crumbs.push({ label: space.name });
    crumbs.push({ label: project?.name ?? '…' });
  }

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
      {crumbs.map((c, i) => (
        <span key={i} className="flex min-w-0 items-center gap-1.5">
          {i > 0 && (
            <span aria-hidden className="text-stone-300">
              /
            </span>
          )}
          {c.href ? (
            <Link
              href={c.href}
              className="rounded text-stone-500 transition-colors hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              {c.label}
            </Link>
          ) : (
            <span
              className={
                i === crumbs.length - 1
                  ? 'truncate font-semibold text-stone-800'
                  : 'truncate text-stone-500'
              }
            >
              {c.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function Topbar() {
  const t = useTranslations();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api<Me>('/auth/me', { tenant: false }),
  });
  const name = me.data?.account?.displayName ?? '';

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-stone-200 bg-white px-4">
      <Breadcrumb />
      <div className="flex items-center gap-3">
        <LocaleSwitcher />
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={t('shell.accountMenu')}
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-card transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            style={{ backgroundColor: avatarColor(name || 'me') }}
          >
            {name ? initialsOf(name) : '·'}
          </button>
          {menuOpen && (
            <>
              <button
                aria-hidden
                tabIndex={-1}
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setMenuOpen(false)}
              />
              <div
                role="menu"
                className="absolute end-0 top-full z-50 mt-1 w-56 rounded-md border border-stone-200 bg-white p-1 shadow-drawer"
              >
                <div className="border-b border-stone-100 px-3 py-2">
                  <p className="truncate text-sm font-semibold text-stone-800">{name}</p>
                  <p className="truncate text-xs text-stone-500">{me.data?.account?.email}</p>
                </div>
                <button
                  role="menuitem"
                  onClick={() => {
                    session.clear();
                    router.push('/login');
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded px-3 py-1.5 text-start text-sm text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
                >
                  <span aria-hidden>⎋</span>
                  {t('auth.signOut')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
