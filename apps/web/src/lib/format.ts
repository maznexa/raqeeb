// Locale-aware display helpers shared by list/board/drawer.

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const AVATAR_COLORS = [
  '#0f766e', '#7c3aed', '#db2777', '#ea580c', '#2563eb', '#059669', '#b45309', '#4f46e5',
];

export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]!;
}

/** "2026-08-22" → localized short date, e.g. "Aug 22" / "٢٢ أغسطس". */
export function formatDay(isoDate: string, locale: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(d);
}

export function isPastDay(isoDate: string): boolean {
  const today = new Date();
  const todayIso = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  return isoDate < todayIso;
}

/** Relative time for comment timestamps ("5 minutes ago" / "قبل ٥ دقائق"). */
export function relativeTime(iso: string, locale: string, justNowLabel: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return justNowLabel;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (abs < 3600) return rtf.format(Math.trunc(diffSec / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.trunc(diffSec / 3600), 'hour');
  if (abs < 2_592_000) return rtf.format(Math.trunc(diffSec / 86_400), 'day');
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));
}
