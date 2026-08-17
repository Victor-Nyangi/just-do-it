import { CheckCircle2, PencilLine, RotateCcw, Trash2 } from 'lucide-react';

import { Button, Card } from '@just-do-it/ui';
import { TaskMetadata } from './task-metadata';
import type { Task } from '../types';

type TaskListProps = {
  hasFiltersApplied: boolean;
  onClearFilters: () => void;
  onDelete: (taskId: string) => void;
  onEdit: (task: Task) => void;
  onToggleComplete: (taskId: string) => void;
  showDueDates: boolean;
  showRecurrence: boolean;
  tasks: Task[];
};

export function TaskList({
  hasFiltersApplied,
  onClearFilters,
  onDelete,
  onEdit,
  onToggleComplete,
  showDueDates,
  showRecurrence,
  tasks,
}: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center">
        <h3 className="text-lg font-bold">Nothing to show right now</h3>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          {hasFiltersApplied
            ? 'Try relaxing the current filters to bring more tasks back into view.'
            : 'Create a task to kick off your session-local plan for today.'}
        </p>
        {hasFiltersApplied ? (
          <Button className="mt-4" onClick={onClearFilters} variant="secondary">
            Clear filters
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <Card className="space-y-4" key={task.id} variant="subtle">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div>
                <h3 className="text-base font-bold">{task.title}</h3>
                {task.description ? (
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">{task.description}</p>
                ) : null}
              </div>
              <TaskMetadata
                showDueDate={showDueDates}
                showRecurrence={showRecurrence}
                task={task}
              />
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button
                aria-label={`Edit ${task.title}`}
                className="h-9 px-3 text-xs"
                onClick={() => onEdit(task)}
                variant="secondary"
              >
                <PencilLine aria-hidden="true" className="mr-2 size-3.5" />
                Edit
              </Button>
              <Button
                aria-label={
                  task.status === 'completed' ? `Reopen ${task.title}` : `Complete ${task.title}`
                }
                className="h-9 px-3 text-xs"
                onClick={() => onToggleComplete(task.id)}
                variant={task.status === 'completed' ? 'accent' : 'primary'}
              >
                {task.status === 'completed' ? (
                  <RotateCcw aria-hidden="true" className="mr-2 size-3.5" />
                ) : (
                  <CheckCircle2 aria-hidden="true" className="mr-2 size-3.5" />
                )}
                {task.status === 'completed' ? 'Reopen' : 'Complete'}
              </Button>
              <Button
                aria-label={`Delete ${task.title}`}
                className="h-9 px-3 text-xs"
                onClick={() => onDelete(task.id)}
                variant="warning"
              >
                <Trash2 aria-hidden="true" className="mr-2 size-3.5" />
                Delete
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
