'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import clsx from 'clsx';
import { api } from '../../lib/api';
import type { ProjectDetail, Status, Task } from '../../lib/types';
import {
  AvatarStack,
  DueDateChip,
  MultiHomeBadge,
  PriorityFlag,
  Skeleton,
  StatusDot,
  TaskGlyph,
} from '../task-bits';

export function BoardView({
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
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [hoverColumn, setHoverColumn] = useState<string | null>(null);

  const tasksKey = ['tasks', project.id];

  // Optimistic column move: patch the cache, PATCH the API, roll back on error.
  const moveToStatus = useMutation({
    mutationFn: ({ taskId, statusId }: { taskId: string; statusId: string }) =>
      api(`/tasks/${taskId}`, { method: 'PATCH', body: { statusId } }),
    onMutate: async ({ taskId, statusId }) => {
      await qc.cancelQueries({ queryKey: tasksKey });
      const previous = qc.getQueryData<Task[]>(tasksKey);
      const target = project.statuses.find((s) => s.id === statusId);
      if (target) {
        qc.setQueryData<Task[]>(tasksKey, (old) =>
          old?.map((task) => (task.id === taskId ? { ...task, status: target } : task)),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(tasksKey, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: tasksKey }),
  });

  function handleDrop(status: Status, e: React.DragEvent) {
    e.preventDefault();
    setHoverColumn(null);
    const taskId = e.dataTransfer.getData('text/plain') || dragTaskId;
    setDragTaskId(null);
    if (!taskId) return;
    const task = tasks?.find((x) => x.id === taskId);
    if (!task || task.status.id === status.id) return;
    moveToStatus.mutate({ taskId, statusId: status.id });
  }

  if (tasksLoading) {
    return (
      <div className="flex gap-4 px-6 py-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex w-72 shrink-0 flex-col gap-2">
            <Skeleton className="h-8" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="scroll-slim flex h-full items-start gap-4 overflow-x-auto px-6 py-4">
      {project.statuses.map((status) => {
        const columnTasks = (tasks ?? []).filter((task) => task.status.id === status.id);
        const hovered = hoverColumn === status.id;
        return (
          <section
            key={status.id}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setHoverColumn(status.id);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget === e.target) setHoverColumn(null);
            }}
            onDrop={(e) => handleDrop(status, e)}
            className={clsx(
              'flex max-h-full w-72 shrink-0 flex-col rounded-md border bg-stone-100/80 transition-colors',
              hovered ? 'border-brand-400 bg-brand-50/70' : 'border-stone-200',
            )}
          >
            <header className="flex items-center gap-2 px-3 py-2.5">
              <StatusDot color={status.color} />
              <h3 className="text-sm font-bold text-stone-700">{status.name}</h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-stone-500 shadow-card">
                {columnTasks.length}
              </span>
            </header>

            <div className="scroll-slim flex min-h-16 flex-col gap-2 overflow-y-auto px-2 pb-2">
              {columnTasks.length === 0 && (
                <p
                  className={clsx(
                    'rounded-md border border-dashed px-3 py-4 text-center text-xs transition-colors',
                    hovered ? 'border-brand-400 text-brand-600' : 'border-stone-300 text-stone-400',
                  )}
                >
                  {hovered ? t('board.dropHere') : t('board.emptyColumn')}
                </p>
              )}
              {columnTasks.map((task) => (
                <article
                  key={task.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', task.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDragTaskId(task.id);
                  }}
                  onDragEnd={() => {
                    setDragTaskId(null);
                    setHoverColumn(null);
                  }}
                  onClick={() => onOpenTask(task.id)}
                  className={clsx(
                    'cursor-grab rounded-md border border-stone-200 bg-white p-3 shadow-card transition-colors hover:border-brand-300',
                    dragTaskId === task.id && 'opacity-50 ring-2 ring-brand-400',
                  )}
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="font-mono text-[10px] text-stone-400">{task.humanId}</span>
                    <MultiHomeBadge task={task} />
                    <span className="ms-auto">
                      <PriorityFlag priority={task.priority} />
                    </span>
                  </div>
                  <p className="mb-2 flex items-start gap-1.5 text-sm font-medium leading-snug text-stone-800">
                    <TaskGlyph kind={task.itemKind} />
                    <span>{task.title}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <AvatarStack assignees={task.assignees} size={5} />
                    <span className="ms-auto">
                      <DueDateChip dueDate={task.dueDate} />
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
