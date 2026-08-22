'use client';

import { useLocale } from 'next-intl';
import { locales } from '@raqeeb/i18n';
import { usePathname, useRouter } from '../i18n/navigation';

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 text-sm">
      {locales.map((l) => (
        <button
          key={l}
          onClick={() => router.replace(pathname, { locale: l })}
          className={
            l === locale
              ? 'rounded bg-brand-500 px-2 py-0.5 font-semibold text-white'
              : 'rounded px-2 py-0.5 text-stone-500 hover:bg-stone-200'
          }
          aria-current={l === locale ? 'true' : undefined}
        >
          {l === 'en' ? 'EN' : 'ع'}
        </button>
      ))}
    </div>
  );
}
