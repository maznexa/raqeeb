'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { use, useState } from 'react';
import clsx from 'clsx';
import { api } from '../../../../../lib/api';
import { Link } from '../../../../../i18n/navigation';
import { LocaleSwitcher } from '../../../../../components/locale-switcher';

interface Status {
  id: string;
  name: string;
  color: string;
  canonicalGroup: 'not_started' | 'active' | 'done' | 'cancelled';
}
interface Section {
  id: string;
  name: string;
}
interface ProjectDetail {
  id: string;
  name: string;
  key: string;
  sections: Section[];
  statuses: Status[];
}
interface Task {
  id: string;
  humanId: string | null;
  title: string;
  itemKind: 'task' | 'milestone' | 'approval';
  status: Status;
  priority: string;
  sectionId: string | null;
  locations: { projectId: string; isPrimary: boolean }[];
  assignees: { membershipId: string; displayName: string }[];
}

export default function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const t = useTranslations();
  const qc = useQueryClient();
  const [newTitle, setNewTitle] = useState('');

  const project = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api<ProjectDetail>(`/projects/${projectId}`),
  });
  const tasks = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => api<Task[]>(`/projects/${projectId}/tasks`),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['tasks', projectId] });

  const createTask = useMutation({
    mutationFn: (title: string) =>
      api('/tasks', { method: 'POST', body: { projectId, title } }),
    onSuccess: () => {
      setNewTitle('');
      void refresh();
    },
  });

  const setStatus = useMutation({
    mutationFn: ({ taskId, statusId }: { taskId: string; statusId: string }) =>
      api(`/tasks/${taskId}`, { method: 'PATCH', body: { statusId } }),
    onSuccess: refresh,
  });

  const move = useMutation({
    mutationFn: (input: { taskId: string; before?: string; after?: string }) =>
      api(`/tasks/${input.taskId}/move`, {
        method: 'POST',
        body: {
          projectId,
          insertBeforeTaskId: input.before,
          insertAfterTaskId: input.after,
        },
      }),
    onSuccess: refresh,
  });

  function moveUp(index: number) {
    const list = tasks.data!;
    if (index === 0) return;
    move.mutate({ taskId: list[index]!.id, before: list[index - 1]!.id });
  }
  function moveDown(index: number) {
    const list = tasks.data!;
    if (index === list.length - 1) return;
    move.mutate({ taskId: list[index]!.id, after: list[index + 1]!.id });
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="mb-6 flex items-center justify-between border-b border-stone-200 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/app" className="text-sm text-brand-600 hover:underline">
            ← {t('nav.projects')}
          </Link>
          <h1 className="text-xl font-bold">{project.data?.name ?? t('common.loading')}</h1>
          <span className="font-mono text-xs text-stone-400">{project.data?.key}</span>
        </div>
        <LocaleSwitcher />
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newTitle.trim()) createTask.mutate(newTitle.trim());
        }}
        className="mb-6 flex gap-2"
      >
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder={t('tasks.taskTitlePlaceholder')}
          className="flex-1 rounded border border-stone-300 p-2 focus:border-brand-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={createTask.isPending}
          className="rounded bg-brand-500 px-4 font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {t('tasks.addTask')}
        </button>
      </form>

      <p className="mb-3 text-sm text-stone-500">
        {t('tasks.taskCount', { count: tasks.data?.length ?? 0 })}
      </p>

      <ul className="flex flex-col gap-1">
        {tasks.data?.map((task, i) => {
          const otherHomes = task.locations.length - 1;
          return (
            <li
              key={task.id}
              className={clsx(
                'flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-3',
                task.status.canonicalGroup === 'done' && 'opacity-60',
              )}
            >
              <div className="flex flex-col">
                <button
                  onClick={() => moveUp(i)}
                  aria-label="Move up"
                  className="text-xs leading-none text-stone-400 hover:text-brand-600"
                >
                  ▲
                </button>
                <button
                  onClick={() => moveDown(i)}
                  aria-label="Move down"
                  className="text-xs leading-none text-stone-400 hover:text-brand-600"
                >
                  ▼
                </button>
              </div>
              <span className="w-16 shrink-0 font-mono text-xs text-stone-400">
                {task.humanId}
              </span>
              <span
                className={clsx(
                  'flex-1 text-sm font-medium',
                  task.status.canonicalGroup === 'done' && 'line-through',
                )}
              >
                {task.itemKind === 'milestone' && <span aria-hidden>◆ </span>}
                {task.itemKind === 'approval' && <span aria-hidden>✓ </span>}
                {task.title}
                {otherHomes > 0 && (
                  <span className="ms-2 rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500">
                    {t('tasks.multiHomedHint', { count: otherHomes })}
                  </span>
                )}
              </span>
              {task.assignees.length > 0 && (
                <span className="hidden text-xs text-stone-500 sm:inline">
                  {task.assignees.map((a) => a.displayName).filter(Boolean).join('، ')}
                </span>
              )}
              <select
                value={task.status.id}
                onChange={(e) => setStatus.mutate({ taskId: task.id, statusId: e.target.value })}
                className="rounded border border-stone-200 p-1 text-xs"
                style={{ color: task.status.color }}
                aria-label={t('tasks.status')}
              >
                {project.data?.statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
