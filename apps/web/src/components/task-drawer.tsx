'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { avatarColor, initialsOf, relativeTime } from '../lib/format';
import type { Comment, Priority, ProjectDetail, Task } from '../lib/types';
import {
  AvatarStack,
  PRIORITY_COLORS,
  Skeleton,
  StatusPillSelect,
  TaskGlyph,
  usePriorityLabels,
} from './task-bits';

type TaskPatch = Partial<{
  title: string;
  description: string | null;
  statusId: string;
  priority: Priority;
  dueDate: string | null;
  estimateMinutes: number | null;
}>;

const PRIORITIES: Priority[] = ['urgent', 'high', 'normal', 'low'];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  'rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-sm transition-colors placeholder:text-stone-400 focus:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40';

export function TaskDrawer({
  project,
  task,
  onClose,
}: {
  project: ProjectDetail;
  task: Task | undefined;
  onClose: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const priorityLabels = usePriorityLabels();
  const [commentBody, setCommentBody] = useState('');

  const open = Boolean(task);

  // Closing must never lose a typed-but-unblurred edit: blur the active field first
  // so its PATCH-on-blur fires, then close.
  const flushAndClose = useCallback(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') flushAndClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, flushAndClose]);

  const patch = useMutation({
    mutationFn: ({ taskId, body }: { taskId: string; body: TaskPatch }) =>
      api(`/tasks/${taskId}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', project.id] }),
  });

  const comments = useQuery({
    queryKey: ['comments', task?.id],
    queryFn: () => api<Comment[]>(`/tasks/${task!.id}/comments`),
    enabled: open,
  });

  const addComment = useMutation({
    mutationFn: (body: string) =>
      api(`/tasks/${task!.id}/comments`, { method: 'POST', body: { body } }),
    onSuccess: () => {
      setCommentBody('');
      void qc.invalidateQueries({ queryKey: ['comments', task?.id] });
    },
  });

  if (!task) return null;
  const send = (id: string, body: TaskPatch) => patch.mutate({ taskId: id, body });

  return (
    <>
      <button
        aria-label={t('common.close')}
        tabIndex={-1}
        onClick={flushAndClose}
        className="fixed inset-0 z-40 cursor-default bg-sidebar-950/25"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t('tasks.details')}
        className="fixed inset-y-0 end-0 z-50 flex w-full max-w-md flex-col border-s border-stone-200 bg-white shadow-drawer"
      >
        {/* Header */}
        <header className="flex items-center gap-2 border-b border-stone-200 px-4 py-3">
          <span className="font-mono text-xs text-stone-400">{task.humanId}</span>
          <TaskGlyph kind={task.itemKind} />
          <span className="ms-auto" />
          <StatusPillSelect
            status={task.status}
            statuses={project.statuses}
            onChange={(statusId) => send(task.id, { statusId })}
          />
          <button
            onClick={flushAndClose}
            aria-label={t('common.close')}
            className="rounded-md p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            ✕
          </button>
        </header>

        <div className="scroll-slim flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4 px-4 py-4">
            {/* Title — PATCH on blur */}
            <input
              key={`title-${task.id}`}
              defaultValue={task.title}
              aria-label={t('tasks.titleLabel')}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== task.title) send(task.id, { title: v });
              }}
              className="w-full rounded-md border border-transparent px-2 py-1.5 text-lg font-bold text-stone-900 transition-colors hover:border-stone-200 focus:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
            />

            {/* Properties grid */}
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('tasks.priority')}>
                <select
                  value={task.priority}
                  onChange={(e) => send(task.id, { priority: e.target.value as Priority })}
                  className={inputCls}
                  style={{ color: PRIORITY_COLORS[task.priority] }}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p} style={{ color: '#1c1917' }}>
                      {priorityLabels[p]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('tasks.dueDate')}>
                <input
                  key={`due-${task.id}`}
                  type="date"
                  defaultValue={task.dueDate ?? ''}
                  onChange={(e) => send(task.id, { dueDate: e.target.value || null })}
                  className={inputCls}
                />
              </Field>
              <Field label={t('tasks.estimateMinutes')}>
                <input
                  key={`est-${task.id}`}
                  type="number"
                  min={1}
                  defaultValue={task.estimateMinutes ?? ''}
                  onBlur={(e) => {
                    const v = e.target.value ? Number(e.target.value) : null;
                    if (v !== task.estimateMinutes) send(task.id, { estimateMinutes: v });
                  }}
                  className={inputCls}
                />
              </Field>
              <Field label={t('tasks.assignees')}>
                <div className="flex min-h-9 items-center px-1">
                  {task.assignees.length > 0 ? (
                    <AvatarStack assignees={task.assignees} />
                  ) : (
                    <span className="text-sm text-stone-400">—</span>
                  )}
                </div>
              </Field>
            </div>

            {/* Description — PATCH on blur */}
            <Field label={t('tasks.description')}>
              <textarea
                key={`desc-${task.id}`}
                defaultValue={task.description ?? ''}
                placeholder={t('tasks.descriptionPlaceholder')}
                rows={4}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if ((v || null) !== (task.description ?? null)) {
                    send(task.id, { description: v || null });
                  }
                }}
                className={clsx(inputCls, 'resize-y leading-relaxed')}
              />
            </Field>
          </div>

          {/* Comments */}
          <section className="border-t border-stone-200 bg-stone-50/60 px-4 py-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-stone-700">
              {t('comments.title')}
              {comments.data && (
                <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-stone-600">
                  {comments.data.length}
                </span>
              )}
            </h3>

            {comments.isLoading && (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            )}
            {comments.data?.length === 0 && (
              <p className="rounded-md border border-dashed border-stone-200 px-3 py-4 text-center text-xs text-stone-400">
                {t('comments.empty')}
              </p>
            )}

            <ul className="flex flex-col gap-3">
              {comments.data?.map((c) => (
                <li key={c.id} className="flex gap-2.5">
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: avatarColor(c.author.membershipId) }}
                  >
                    {initialsOf(c.author.displayName || '?')}
                  </span>
                  <div className="min-w-0 flex-1 rounded-md border border-stone-200 bg-white px-3 py-2 shadow-card">
                    <p className="mb-0.5 flex flex-wrap items-baseline gap-x-2 text-xs">
                      <span className="font-semibold text-stone-800">
                        {c.author.displayName}
                      </span>
                      <span className="text-stone-400">
                        {relativeTime(c.createdAt, locale, t('comments.justNow'))}
                      </span>
                      {c.edited && (
                        <span className="italic text-stone-400">· {t('comments.edited')}</span>
                      )}
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
                      {c.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (commentBody.trim()) addComment.mutate(commentBody.trim());
              }}
              className="mt-3 flex flex-col gap-2"
            >
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder={t('comments.placeholder')}
                rows={2}
                className={clsx(inputCls, 'resize-none')}
              />
              <button
                type="submit"
                disabled={addComment.isPending || !commentBody.trim()}
                className="self-end rounded-md bg-brand-500 px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50"
              >
                {t('comments.send')}
              </button>
            </form>
          </section>
        </div>
      </aside>
    </>
  );
}
