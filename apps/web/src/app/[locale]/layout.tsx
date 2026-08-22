import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { dirFor, isLocale, type Locale } from '@raqeeb/i18n';
import { routing } from '../../i18n/routing';
import { Providers } from '../../components/providers';
import '../globals.css';

export const metadata = {
  title: 'Raqeeb',
  description: 'Unified work, project & resource management',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = await getMessages();

  return (
    <html lang={locale} dir={dirFor(locale as Locale)}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
