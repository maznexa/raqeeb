'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, session } from '../../../lib/api';
import { Link, useRouter } from '../../../i18n/navigation';
import { LocaleSwitcher } from '../../../components/locale-switcher';

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ accessToken: string; refreshToken: string }>('/auth/login', {
        method: 'POST',
        body: { email, password },
        tenant: false,
      });
      session.store(res);
      router.push('/app');
    } catch {
      setError(t('auth.invalidCredentials'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-700">{t('auth.signInTitle')}</h1>
        <LocaleSwitcher />
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('auth.email')}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-stone-300 p-2 focus:border-brand-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('auth.password')}
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-stone-300 p-2 focus:border-brand-500 focus:outline-none"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-brand-500 p-2 font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {busy ? t('common.loading') : t('auth.signIn')}
        </button>
      </form>
      <p className="text-sm text-stone-600">
        {t('auth.noAccount')}{' '}
        <Link href="/signup" className="font-medium text-brand-600 underline">
          {t('auth.signUp')}
        </Link>
      </p>
    </main>
  );
}
