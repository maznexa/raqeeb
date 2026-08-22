'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import clsx from 'clsx';
import { api } from '../../lib/api';
import type { Project, Space } from '../../lib/types';
import { Link, usePathname } from '../../i18n/navigation';
import { useTenant } from './tenant-context';
import { TenantSwitcher } from './tenant-switcher';

function NavItem({
  href,
  label,
  icon,
  active,
  collapsed,
  soonBadge,
}: {
  href?: string;
  label: string;
  icon: string;
  active?: boolean;
  collapsed: boolean;
  soonBadge?: string;
}) {
  const inner = (
    <>
      <span aria-hidden className="w-5 text-center text-sm">
        {icon}
      </span>
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {!collapsed && soonBadge && (
        <span className="rounded bg-sidebar-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sidebar-300">
          {soonBadge}
        </span>
      )}
    </>
  );
  const cls = clsx(
    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
    active ? 'bg-sidebar-600 text-white' : 'text-sidebar-300 hover:bg-sidebar-700 hover:text-sidebar-100',
  );
  if (!href) {
    return (
      <span className={clsx(cls, 'cursor-default opacity-70')} title={soonBadge}>
        {inner}
      </span>
    );
  }
  return (
    <Link href={href} className={cls} title={collapsed ? label : undefined}>
      {inner}
    </Link>
  );
}

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const { slug } = useTenant();
  const [closedSpaces, setClosedSpaces] = useState<Record<string, boolean>>({});

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

  const bySpace = new Map<string, Project[]>();
  for (const p of projects.data ?? []) {
    const list = bySpace.get(p.spaceId) ?? [];
    list.push(p);
    bySpace.set(p.spaceId, list);
  }

  return (
    <aside
      className={clsx(
        'flex h-full shrink-0 flex-col border-e border-sidebar-700 bg-sidebar-900 transition-all',
        collapsed ? 'w-14' : 'w-64',
      )}
    >
      {/* Brand block */}
      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 text-sm font-black text-white shadow-card"
        >
          ر
        </span>
        {!collapsed && (
          <span className="flex-1 truncate text-base font-bold tracking-tight text-white">
            {t('common.appName')}
          </span>
        )}
        <button
          onClick={onToggle}
          aria-label={collapsed ? t('shell.expandSidebar') : t('shell.collapseSidebar')}
          className="rounded p-1 text-sidebar-400 transition-colors hover:bg-sidebar-700 hover:text-sidebar-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <span aria-hidden className="inline-block text-xs rtl:-scale-x-100">
            {collapsed ? '»' : '«'}
          </span>
        </button>
      </div>

      {/* Tenant switcher */}
      <div className="px-2 pb-2">
        <TenantSwitcher collapsed={collapsed} />
      </div>

      <div className="mx-3 border-t border-sidebar-700" />

      {/* Primary nav */}
      <nav className="flex flex-col gap-0.5 p-2">
        <NavItem
          href="/app"
          label={t('nav.home')}
          icon="⌂"
          active={pathname === '/app'}
          collapsed={collapsed}
        />
        <NavItem
          label={t('nav.myTasks')}
          icon="☑"
          collapsed={collapsed}
          soonBadge={t('shell.soon')}
        />
      </nav>

      {/* Spaces → projects tree */}
      <div className="scroll-slim-dark flex-1 overflow-y-auto px-2 pb-4">
        {!collapsed && (
          <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-400">
            {t('nav.spaces')}
          </p>
        )}
        {spaces.isLoading && (
          <div className="flex flex-col gap-2 p-2" aria-hidden>
            <div className="h-4 animate-pulse rounded bg-sidebar-700" />
            <div className="h-4 animate-pulse rounded bg-sidebar-700" />
            <div className="h-4 animate-pulse rounded bg-sidebar-700" />
          </div>
        )}
        {!collapsed && spaces.data?.length === 0 && (
          <p className="px-2 py-1 text-xs text-sidebar-400">{t('shell.noSpaces')}</p>
        )}
        {spaces.data?.map((space) => {
          const spaceProjects = bySpace.get(space.id) ?? [];
          const closed = closedSpaces[space.id] ?? false;
          return (
            <div key={space.id} className="mb-1">
              <button
                onClick={() => setClosedSpaces((s) => ({ ...s, [space.id]: !closed }))}
                aria-expanded={!closed}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-sidebar-200 transition-colors hover:bg-sidebar-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                title={collapsed ? space.name : undefined}
              >
                <span aria-hidden className="w-5 text-center text-xs">
                  {space.icon ?? '◨'}
                </span>
                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1 truncate text-start">{space.name}</span>
                    <span aria-hidden className="text-[10px] text-sidebar-400">
                      {closed ? (
                        <span className="inline-block rtl:-scale-x-100">▸</span>
                      ) : (
                        '▾'
                      )}
                    </span>
                  </>
                )}
              </button>
              {!closed &&
                !collapsed &&
                spaceProjects.map((p) => {
                  const href = `/app/projects/${p.id}`;
                  const active = pathname.startsWith(href);
                  return (
                    <Link
                      key={p.id}
                      href={href}
                      className={clsx(
                        'ms-4 flex items-center gap-2 rounded-md border-s-2 py-1.5 pe-2 ps-3 text-sm transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
                        active
                          ? 'border-brand-400 bg-sidebar-600 font-medium text-white'
                          : 'border-sidebar-700 text-sidebar-300 hover:bg-sidebar-700 hover:text-sidebar-100',
                      )}
                    >
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: p.color ?? '#2dd4bf' }}
                      />
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      <span className="font-mono text-[10px] text-sidebar-400">{p.key}</span>
                    </Link>
                  );
                })}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
