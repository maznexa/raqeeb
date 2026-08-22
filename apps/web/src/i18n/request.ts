import { getRequestConfig } from 'next-intl/server';
import { isLocale, messages } from '@raqeeb/i18n';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: messages[locale],
  };
});
