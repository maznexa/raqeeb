'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api, session } from '../../../lib/api';
import { Link, useRouter } from '../../../i18n/navigation';
import { LocaleSwitcher } from '../../../components/locale-switcher';

export default function SignupPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [form, setForm] = useState({ displayName: '', email: '', password: '', tenantName: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{
        accessToken: string;
        refreshToken: string;
        tenant: { slug: string } | null;
      }>('/auth/signup', {
        method: 'POST',
        body: { ...form, locale },
        tenant: false,
      });
      session.store(res);
      if (res.tenant) session.setTenant(res.tenant.slug);
      router.push('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  const field =
    'rounded border border-stone-300 p-2 focus:border-brand-500 focus:outline-none';

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-700">{t('auth.signUpTitle')}</h1>
        <LocaleSwitcher />
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('auth.displayName')}
          <input required value={form.displayName} onChange={(e) => set('displayName', e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('auth.workspaceName')}
          <input required value={form.tenantName} onChange={(e) => set('tenantName', e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('auth.email')}
          <input type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('auth.password')}
          <input type="password" required minLength={8} value={form.password} onChange={(e) => set('password', e.target.value)} className={field} />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-brand-500 p-2 font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {busy ? t('common.loading') : t('auth.signUp')}
        </button>
      </form>
      <p className="text-sm text-stone-600">
        {t('auth.haveAccount')}{' '}
        <Link href="/login" className="font-medium text-brand-600 underline">
          {t('auth.signIn')}
        </Link>
      </p>
    </main>
  );
}
