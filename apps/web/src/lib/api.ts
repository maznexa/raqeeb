'use client';

/**
 * Minimal typed API client for the scaffold.
 * Tokens live in localStorage (scaffold-grade; the P1 hardening pass moves the
 * session to httpOnly cookies — documented in docs/04-architecture/07-security.md).
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const KEYS = {
  access: 'raqeeb.access',
  refresh: 'raqeeb.refresh',
  tenantSlug: 'raqeeb.tenantSlug',
} as const;

export const session = {
  get access() {
    return typeof window === 'undefined' ? null : localStorage.getItem(KEYS.access);
  },
  get tenantSlug() {
    return typeof window === 'undefined' ? null : localStorage.getItem(KEYS.tenantSlug);
  },
  store(tokens: { accessToken: string; refreshToken: string }) {
    localStorage.setItem(KEYS.access, tokens.accessToken);
    localStorage.setItem(KEYS.refresh, tokens.refreshToken);
  },
  setTenant(slug: string) {
    localStorage.setItem(KEYS.tenantSlug, slug);
  },
  clear() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public title: string,
    public body: unknown,
  ) {
    super(title);
  }
}

export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown; tenant?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const access = session.access;
  if (access) headers.Authorization = `Bearer ${access}`;
  if (opts.tenant !== false && session.tenantSlug) {
    headers['X-Tenant-Slug'] = session.tenantSlug;
  }
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/')) {
    session.clear();
    const locale = window.location.pathname.split('/')[1] || 'en';
    window.location.href = `/${locale}/login`;
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, json?.title ?? res.statusText, json);
  }
  return json as T;
}
