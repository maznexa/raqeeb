'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import clsx from 'clsx';
import { useTenant } from './tenant-context';

/** Sidebar workspace switcher — dark dropdown listing the user's tenants. */
export function TenantSwitcher({ collapsed }: { collapsed: boolean }) {
  const t = useTranslations();
  const { tenants, current, switchTenant } = useTenant();
  const [open, setOpen] = useState(false);

  const mark = (current?.name ?? '·').slice(0, 1).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('nav.switchTenant')}
        className={clsx(
          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start transition-colors',
          'hover:bg-sidebar-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
          open && 'bg-sidebar-700',
        )}
      >
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white"
        >
          {mark}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-sidebar-100">
              {current?.name ?? t('common.loading')}
            </span>
            <span aria-hidden className="text-[10px] text-sidebar-400">
              ▾
            </span>
          </>
        )}
      </button>

      {open && (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="listbox"
            aria-label={t('shell.workspaces')}
            className="absolute start-0 top-full z-50 mt-1 w-56 rounded-md border border-sidebar-600 bg-sidebar-800 p-1 shadow-drawer"
          >
            <p className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-400">
              {t('shell.workspaces')}
            </p>
            {tenants?.map((tn) => (
              <button
                key={tn.tenantId}
                role="option"
                aria-selected={tn.slug === current?.slug}
                onClick={() => {
                  switchTenant(tn.slug);
                  setOpen(false);
                }}
                className={clsx(
                  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-sm transition-colors',
                  tn.slug === current?.slug
                    ? 'bg-sidebar-600 text-white'
                    : 'text-sidebar-200 hover:bg-sidebar-700',
                )}
              >
                <span
                  aria-hidden
                  className="flex h-5 w-5 items-center justify-center rounded bg-sidebar-500 text-[10px] font-bold text-white"
                >
                  {tn.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate">{tn.name}</span>
                {tn.slug === current?.slug && (
                  <span aria-hidden className="text-brand-300">
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
