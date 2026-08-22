import ar from '../messages/ar.json';
import en from '../messages/en.json';

export const locales = ['en', 'ar'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

/** Text direction per locale — the root layout sets <html dir={dirFor(locale)}>. */
export function dirFor(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** Message catalogs, bundled at build time (ICU format; source of truth: messages/*.json). */
export const messages: Record<Locale, typeof en> = { en, ar };
