'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import clsx from 'clsx';
import { api } from '../../lib/api';
import type { ProjectDetail, Task } from '../../lib/types';
import {
  AvatarStack,
  DueDateChip,
  MultiHomeBadge,
  PriorityFlag,
  Skeleton,
  StatusPillSelect,
  TaskGlyph,
} from '../task-bits';

interface Group {
  id: string | null;
  name: string;
  tasks: Task[];
}

function sectionIdFor(task: Task, projectId: string): string | null {
  return task.locations.find((l) => l.projectId === projectId)?.sectionId ?? null;
}

export function ListView({
  project,
  tasks,
  tasksLoading,
  onOpenTask,
}: {
  project: ProjectDetail;
  tasks: Task[] | undefined;
  tasksLoading: boolean;
  onOpenTask: (taskId: string) => void;
}) {
  const t = useTranslations();
  const qc = useQueryClient();
  const [newTitle, setNewTitle] = useState('');
  const [closedSections, setClosedSections] = useState<Record<string, boolean>>({});

  const refresh = () => qc.invalidateQueries({ queryKey: ['tasks', project.id] });

  const createTask = useMutation({
    mutationFn: (title: string) =>
      api('/tasks', { method: 'POST', body: { projectId: project.id, title } }),
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
          projectId: project.id,
          insertBeforeTaskId: input.before,
          insertAfterTaskId: input.after,
        },
      }),
    onSuccess: refresh,
  });

  // Group in list order: unsectioned tasks first, then sections in project order.
  const groups: Group[] = [];
  const unsectioned = (tasks ?? []).filter((task) => sectionIdFor(task, project.id) === null);
  if (unsectioned.length > 0 || project.sections.length === 0) {
    groups.push({ id: null, name: t('tasks.noSection'), tasks: unsectioned });
  }
  for (const section of project.sections) {
    groups.push({
      id: section.id,
      name: section.name,
      tasks: (tasks ?? []).filter((task) => sectionIdFor(task, project.id) === section.id),
    });
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-4">
      {/* Page-top quick add (smoke tests target this placeholder) */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newTitle.trim()) createTask.mutate(newTitle.trim());
        }}
        className="flex gap-2"
      >
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder={t('tasks.taskTitlePlaceholder')}
          className="flex-1 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm shadow-card transition-colors placeholder:text-stone-400 focus:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
        />
        <button
          type="submit"
          disabled={createTask.isPending || !newTitle.trim()}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50"
        >
          {t('tasks.addTask')}
        </button>
      </form>

      {tasksLoading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
        </div>
      )}

      {groups.map((group) => {
        const key = group.id ?? '__none__';
        const closed = closedSections[key] ?? false;
        return (
          <section key={key}>
            <button
              onClick={() => setClosedSections((s) => ({ ...s, [key]: !closed }))}
              aria-expanded={!closed}
              className="mb-1.5 flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <span aria-hidden className="text-[10px] text-stone-400">
                {closed ? <span className="inline-block rtl:-scale-x-100">▸</span> : '▾'}
              </span>
              <span className="text-sm font-bold text-stone-700">{group.name}</span>
              <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-stone-600">
                {group.tasks.length}
              </span>
            </button>

            {!closed && group.tasks.length === 0 && (
              <p className="ms-6 rounded-md border border-dashed border-stone-200 px-3 py-2 text-xs text-stone-400">
                {t('tasks.emptySection')}
              </p>
            )}

            {!closed && (
              <ul className="flex flex-col overflow-hidden rounded-md border border-stone-200 bg-white shadow-card empty:hidden">
                {group.tasks.map((task, i) => {
                  const done = task.status.canonicalGroup === 'done';
                  return (
                    <li
                      key={task.id}
                      onClick={() => onOpenTask(task.id)}
                      className={clsx(
                        'group flex cursor-pointer items-center gap-3 border-b border-stone-100 px-3 py-2 transition-colors last:border-b-0 hover:bg-brand-50/60',
                        done && 'opacity-60',
                      )}
                    >
                      <div className="flex shrink-0 flex-col text-stone-300">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (i === 0) return;
                            move.mutate({ taskId: task.id, before: group.tasks[i - 1]!.id });
                          }}
                          aria-label="Move up"
                          className="text-[10px] leading-none transition-colors hover:text-brand-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-400"
                        >
                          ▲
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (i === group.tasks.length - 1) return;
                            move.mutate({ taskId: task.id, after: group.tasks[i + 1]!.id });
                          }}
                          aria-label="Move down"
                          className="text-[10px] leading-none transition-colors hover:text-brand-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-400"
                        >
                          ▼
                        </button>
                      </div>

                      <span className="w-16 shrink-0 font-mono text-[11px] text-stone-400">
                        {task.humanId}
                      </span>

                      <span className="flex min-w-0 flex-1 items-center gap-1.5">
                        <TaskGlyph kind={task.itemKind} />
                        <span
                          className={clsx(
                            'truncate text-sm font-medium text-stone-800',
                            done && 'line-through',
                          )}
                        >
                          {task.title}
                        </span>
                        <MultiHomeBadge task={task} />
                        <span
                          aria-hidden
                          className="hidden text-[11px] text-brand-500 opacity-0 transition-opacity group-hover:opacity-100 sm:inline"
                        >
                          {t('tasks.openTask')}
                        </span>
                      </span>

                      <PriorityFlag priority={task.priority} className="shrink-0" />
                      <AvatarStack assignees={task.assignees} />
                      <DueDateChip dueDate={task.dueDate} />
                      <StatusPillSelect
                        status={task.status}
                        statuses={project.statuses}
                        disabled={setStatus.isPending}
                        onChange={(statusId) => setStatus.mutate({ taskId: task.id, statusId })}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
