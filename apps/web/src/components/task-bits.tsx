'use client';

import { useLocale, useTranslations } from 'next-intl';
import clsx from 'clsx';
import { avatarColor, formatDay, initialsOf, isPastDay } from '../lib/format';
import type { Priority, Status, Task } from '../lib/types';

/** Black-or-white text for an arbitrary DB status color (YIQ contrast). */
export function contrastText(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#ffffff';
  const n = parseInt(m[1]!, 16);
  const yiq = (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
  return yiq >= 160 ? '#1c1917' : '#ffffff';
}

export const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: '#ef4444',
  high: '#f59e0b',
  normal: '#3b82f6',
  low: '#94a3b8',
};

export function usePriorityLabels(): Record<Priority, string> {
  const t = useTranslations();
  return {
    urgent: t('tasks.priorityUrgent'),
    high: t('tasks.priorityHigh'),
    normal: t('tasks.priorityNormal'),
    low: t('tasks.priorityLow'),
  };
}

export function PriorityFlag({ priority, className }: { priority: Priority; className?: string }) {
  const labels = usePriorityLabels();
  return (
    <span
      title={labels[priority]}
      aria-label={labels[priority]}
      className={clsx('text-sm leading-none', className)}
      style={{ color: PRIORITY_COLORS[priority] }}
    >
      ⚑
    </span>
  );
}

/** Monday-style saturated status pill that is actually a <select>. */
export function StatusPillSelect({
  status,
  statuses,
  onChange,
  disabled,
}: {
  status: Status;
  statuses: Status[];
  onChange: (statusId: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations();
  return (
    <select
      value={status.id}
      disabled={disabled}
      aria-label={t('tasks.status')}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
      className="w-28 shrink-0 cursor-pointer appearance-none rounded-md border-0 px-2.5 py-1 text-center text-xs font-semibold shadow-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-60"
      style={{ backgroundColor: status.color, color: contrastText(status.color) }}
    >
      {statuses.map((s) => (
        <option key={s.id} value={s.id} style={{ backgroundColor: '#fff', color: '#1c1917' }}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

export function StatusDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

export function AvatarStack({
  assignees,
  size = 6,
}: {
  assignees: { membershipId: string; displayName: string }[];
  size?: 5 | 6;
}) {
  if (assignees.length === 0) return null;
  const shown = assignees.slice(0, 3);
  const extra = assignees.length - shown.length;
  const dim = size === 5 ? 'h-5 w-5 text-[9px]' : 'h-6 w-6 text-[10px]';
  return (
    <span className="flex items-center">
      {shown.map((a, i) => (
        <span
          key={a.membershipId}
          title={a.displayName}
          className={clsx(
            dim,
            'flex items-center justify-center rounded-full font-bold text-white ring-2 ring-white',
            i > 0 && '-ms-1.5',
          )}
          style={{ backgroundColor: avatarColor(a.membershipId) }}
        >
          {initialsOf(a.displayName || '?')}
        </span>
      ))}
      {extra > 0 && (
        <span
          className={clsx(
            dim,
            '-ms-1.5 flex items-center justify-center rounded-full bg-stone-200 font-bold text-stone-600 ring-2 ring-white',
          )}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

export function DueDateChip({ dueDate }: { dueDate: string | null }) {
  const t = useTranslations();
  const locale = useLocale();
  if (!dueDate) return null;
  const overdue = isPastDay(dueDate);
  return (
    <span
      title={overdue ? t('tasks.overdue') : t('tasks.dueDate')}
      className={clsx(
        'shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums',
        overdue ? 'bg-red-50 text-red-600' : 'bg-stone-100 text-stone-500',
      )}
    >
      {formatDay(dueDate, locale)}
    </span>
  );
}

export function TaskGlyph({ kind }: { kind: Task['itemKind'] }) {
  const t = useTranslations();
  if (kind === 'milestone') {
    return (
      <span aria-label={t('tasks.milestone')} title={t('tasks.milestone')} className="text-amber-500">
        ◆
      </span>
    );
  }
  if (kind === 'approval') {
    return (
      <span aria-label={t('tasks.approval')} title={t('tasks.approval')} className="text-violet-500">
        ✓
      </span>
    );
  }
  return null;
}

export function MultiHomeBadge({ task }: { task: Task }) {
  const t = useTranslations();
  const otherHomes = task.locations.length - 1;
  if (otherHomes <= 0) return null;
  return (
    <span
      title={t('tasks.multiHomedHint', { count: otherHomes })}
      className="shrink-0 rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-600"
    >
      ⧉ {otherHomes + 1}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx('animate-pulse rounded-md bg-stone-200', className)} />;
}
