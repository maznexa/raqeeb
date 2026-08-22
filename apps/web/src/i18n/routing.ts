import { defineRouting } from 'next-intl/routing';
import { locales, defaultLocale } from '@raqeeb/i18n';

export const routing = defineRouting({
  locales,
  defaultLocale,
});
