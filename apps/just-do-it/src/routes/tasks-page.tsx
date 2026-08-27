import { CalendarClock, CheckCircle2, ListFilter, Repeat2, Sparkles } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { Badge, Button, Card } from '@just-do-it/ui';
import {
  QuickAddField,
  TaskFiltersPanel,
  TaskForm,
  TaskList,
  defaultTaskEditorValues,
  selectFilteredTasks,
  selectRecurringTaskCount,
  selectScheduledTaskCount,
  toTaskEditorValues,
  toTaskInput,
  useCompletedTaskCount,
  useCreateTask,
  useDeleteTask,
  useOpenTaskCount,
  useTasks,
  useToggleTaskCompletion,
  useUpdateTask,
  type Task,
  type TaskEditorValues,
  type TaskFilters,
} from '../features/tasks';

const defaultFilters: TaskFilters = {
  priority: 'all',
  category: 'all',
};

export function TasksPage() {
  const tasks = useTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const toggleTaskCompletion = useToggleTaskCompletion();
  const deleteTask = useDeleteTask();
  const openTaskCount = useOpenTaskCount();
  const completedTaskCount = useCompletedTaskCount();
  const composerRef = useRef<HTMLDivElement | null>(null);

  const [filters, setFilters] = useState<TaskFilters>(defaultFilters);
  const [showDueDates, setShowDueDates] = useState(true);
  const [showRecurrence, setShowRecurrence] = useState(true);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [formResetKey, setFormResetKey] = useState(0);

  const editingTask = useMemo(
    () => tasks.find((task) => task.id === editingTaskId) ?? null,
    [editingTaskId, tasks],
  );
  const filteredTasks = useMemo(() => selectFilteredTasks(tasks, filters), [tasks, filters]);
  const scheduledTaskCount = useMemo(() => selectScheduledTaskCount(tasks), [tasks]);
  const recurringTaskCount = useMemo(() => selectRecurringTaskCount(tasks), [tasks]);
  const hasFiltersApplied = filters.priority !== 'all' || filters.category !== 'all';

  const formInitialValues = editingTask ? toTaskEditorValues(editingTask) : defaultTaskEditorValues;
  const formKey = editingTask
    ? `edit-${editingTask.id}-${editingTask.updatedAt}`
    : `create-${formResetKey}`;

  function focusComposer() {
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetComposer() {
    setEditingTaskId(null);
    setFormResetKey((current) => current + 1);
  }

  function handleSubmit(values: TaskEditorValues) {
    const input = toTaskInput(values);

    if (editingTask) {
      updateTask(editingTask.id, input);
      resetComposer();
      return;
    }

    createTask(input);
    resetComposer();
  }

  function handleEdit(task: Task) {
    setEditingTaskId(task.id);
    focusComposer();
  }

  function handleDelete(taskId: string) {
    deleteTask(taskId);

    if (editingTaskId === taskId) {
      resetComposer();
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <section className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <Badge tone="accent">Static task domain</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Tasks</h1>
          <p className="mt-2 max-w-2xl text-[var(--muted-foreground)]">
            Capture work, shape what matters, and keep this session moving with a polished
            local-first planner.
          </p>
        </div>
        <Button
          onClick={() => {
            resetComposer();
            focusComposer();
          }}
        >
          <Sparkles aria-hidden="true" className="mr-2 size-4" />
          New task
        </Button>
      </section>

      <Card className="mb-6">
        <div className="mb-4">
          <h2 className="font-bold">Quick add</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Type a day, <code>#category</code> or <code>!priority</code> straight into the title.
          </p>
        </div>
        <QuickAddField />
      </Card>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <div className="flex items-center gap-3">
            <CheckCircle2 aria-hidden="true" className="size-5 text-[var(--primary)]" />
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Open</p>
              <p className="text-2xl font-bold">{openTaskCount}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <CalendarClock aria-hidden="true" className="size-5 text-[var(--accent)]" />
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Scheduled</p>
              <p className="text-2xl font-bold">{scheduledTaskCount}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <Repeat2 aria-hidden="true" className="size-5 text-[var(--warning)]" />
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Recurring</p>
              <p className="text-2xl font-bold">{recurringTaskCount}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <div className="space-y-6">
          <Card>
            <TaskFiltersPanel
              filters={filters}
              hasFiltersApplied={hasFiltersApplied}
              onCategoryChange={(category) => setFilters((current) => ({ ...current, category }))}
              onClearFilters={() => setFilters(defaultFilters)}
              onPriorityChange={(priority) => setFilters((current) => ({ ...current, priority }))}
              onToggleDueDates={() => setShowDueDates((current) => !current)}
              onToggleRecurrence={() => setShowRecurrence((current) => !current)}
              showDueDates={showDueDates}
              showRecurrence={showRecurrence}
            />
          </Card>

          <Card>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Task list</h2>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {filteredTasks.length === 0
                    ? 'No matching tasks yet.'
                    : `${filteredTasks.length} task${filteredTasks.length === 1 ? '' : 's'} in view.`}
                </p>
              </div>
              <Badge tone={completedTaskCount > 0 ? 'success' : 'neutral'}>
                {completedTaskCount} completed
              </Badge>
            </div>
            <TaskList
              hasFiltersApplied={hasFiltersApplied}
              onClearFilters={() => setFilters(defaultFilters)}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onToggleComplete={toggleTaskCompletion}
              showDueDates={showDueDates}
              showRecurrence={showRecurrence}
              tasks={filteredTasks}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <div ref={composerRef}>
            <Card>
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <Badge tone={editingTask ? 'accent' : 'neutral'}>
                    {editingTask ? 'Editing task' : 'Task composer'}
                  </Badge>
                  <h2 className="mt-3 text-lg font-bold">
                    {editingTask ? `Update ${editingTask.title}` : 'Create a task'}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    Use categories, priorities, and recurrence to keep the model ready for later
                    phases.
                  </p>
                </div>
                <ListFilter aria-hidden="true" className="size-5 text-[var(--muted-foreground)]" />
              </div>
              <TaskForm
                initialValues={formInitialValues}
                key={formKey}
                mode={editingTask ? 'edit' : 'create'}
                onCancel={editingTask ? resetComposer : undefined}
                onSubmit={handleSubmit}
              />
            </Card>
          </div>

          <Card variant="accent">
            <h2 className="text-lg font-bold">Session-local notes</h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Changes are stored in memory only for this session, so a page refresh will restore the
              validated fixture state.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
