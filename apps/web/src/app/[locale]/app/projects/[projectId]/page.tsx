'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, use, useState } from 'react';
import clsx from 'clsx';
import { api } from '../../../../../lib/api';
import type { ProjectDetail, Task } from '../../../../../lib/types';
import { usePathname, useRouter } from '../../../../../i18n/navigation';
import { BoardView } from '../../../../../components/project/board-view';
import { ListView } from '../../../../../components/project/list-view';
import { TaskDrawer } from '../../../../../components/task-drawer';
import { Skeleton } from '../../../../../components/task-bits';

// View tab lives in the URL as ?view=list|board (default: list).
type View = 'list' | 'board';

function ProjectView({ projectId }: { projectId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view: View = searchParams.get('view') === 'board' ? 'board' : 'list';
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const project = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api<ProjectDetail>(`/projects/${projectId}`),
  });
  const tasks = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => api<Task[]>(`/projects/${projectId}/tasks`),
  });

  const setView = (next: View) => {
    router.replace(next === 'board' ? `${pathname}?view=board` : pathname);
  };

  if (project.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-4">
        <Skeleton className="mb-4 h-8 w-64" />
        <Skeleton className="mb-2 h-10" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (project.isError || !project.data) {
    return <p className="px-6 py-8 text-sm text-stone-500">{t('common.error')}</p>;
  }

  const detail = project.data;
  const openTask = openTaskId ? tasks.data?.find((task) => task.id === openTaskId) : undefined;

  return (
    <div className="flex h-full flex-col">
      {/* Project header + view tabs */}
      <div className="shrink-0 border-b border-stone-200 bg-white px-6 pt-4">
        <div className="flex items-center gap-3 pb-3">
          <span
            aria-hidden
            className="h-4 w-4 rounded-md"
            style={{ backgroundColor: detail.color ?? '#0f766e' }}
          />
          <h1 className="text-xl font-bold text-stone-900">{detail.name}</h1>
          <span className="rounded-md bg-stone-100 px-2 py-0.5 font-mono text-xs text-stone-500">
            {detail.key}
          </span>
          <span className="ms-auto text-sm text-stone-500">
            {t('tasks.taskCount', { count: tasks.data?.length ?? 0 })}
          </span>
        </div>
        <div role="tablist" aria-label={t('tasks.status')} className="flex gap-1">
          {(['list', 'board'] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={clsx(
                '-mb-px flex items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 text-sm font-semibold transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
                view === v
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-stone-500 hover:bg-stone-50 hover:text-stone-800',
              )}
            >
              <span aria-hidden>{v === 'list' ? '☰' : '▦'}</span>
              {t(`views.${v}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Active view */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {view === 'list' ? (
          <ListView
            project={detail}
            tasks={tasks.data}
            tasksLoading={tasks.isLoading}
            onOpenTask={setOpenTaskId}
          />
        ) : (
          <BoardView
            project={detail}
            tasks={tasks.data}
            tasksLoading={tasks.isLoading}
            onOpenTask={setOpenTaskId}
          />
        )}
      </div>

      <TaskDrawer project={detail} task={openTask} onClose={() => setOpenTaskId(null)} />
    </div>
  );
}

export default function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  return (
    // useSearchParams requires a Suspense boundary during prerender.
    <Suspense fallback={null}>
      <ProjectView projectId={projectId} />
    </Suspense>
  );
}
