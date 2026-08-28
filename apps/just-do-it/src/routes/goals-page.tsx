import { addDays, compareAsc, format, parseISO } from 'date-fns';
import { CalendarClock, CheckCircle2, Goal as GoalIcon, Plus, Sparkles } from 'lucide-react';
import { useMemo, useRef, useState, type FormEvent } from 'react';

import { Badge, type BadgeTone, Button, Card, Input, cn } from '@just-do-it/ui';
import {
  GOAL_STATUS_VALUES,
  defaultGoalEditorValues,
  formatGoalDeadlineLabel,
  formatGoalStatusLabel,
  formatGoalTargetDate,
  toGoalInput,
  useCreateGoal,
  useGoals,
  useUpdateGoal,
  useUpdateGoalProgress,
  useUpdateGoalStatus,
  type Goal,
  type GoalEditorValues,
  type GoalStatus,
} from '../features/goals';

const controlClassName =
  'min-h-10 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]';

const goalStatusTone: Record<GoalStatus, BadgeTone> = {
  active: 'accent',
  paused: 'warning',
  completed: 'success',
};

function createDefaultGoalValues(): GoalEditorValues {
  return {
    ...defaultGoalEditorValues,
    targetDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
  };
}

function sortGoals(goals: readonly Goal[]): Goal[] {
  const statusOrder = {
    active: 0,
    paused: 1,
    completed: 2,
  } as const;

  return [...goals].sort((leftGoal, rightGoal) => {
    const statusComparison = statusOrder[leftGoal.status] - statusOrder[rightGoal.status];

    if (statusComparison !== 0) return statusComparison;

    const targetDateComparison = compareAsc(
      parseISO(leftGoal.targetDate),
      parseISO(rightGoal.targetDate),
    );

    if (targetDateComparison !== 0) return targetDateComparison;

    return rightGoal.progress - leftGoal.progress;
  });
}

function GoalStatusButton({
  active,
  onClick,
  status,
}: {
  active: boolean;
  onClick: () => void;
  status: GoalStatus;
}) {
  const activeClassName =
    status === 'active'
      ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]'
      : status === 'paused'
        ? 'border-[var(--warning)] bg-[var(--warning-subtle)] text-[var(--warning)]'
        : 'border-[var(--success)] bg-[var(--success-subtle)] text-[var(--success)]';

  return (
    <button
      aria-pressed={active}
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2',
        active
          ? activeClassName
          : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]',
      )}
      onClick={onClick}
      type="button"
    >
      {formatGoalStatusLabel(status)}
    </button>
  );
}

function GoalsEmptyState({ onCreateGoal }: { onCreateGoal: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--muted-foreground)]">
        <GoalIcon aria-hidden="true" className="size-6" />
      </div>
      <h3 className="mt-4 text-lg font-bold">No goals in view yet</h3>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        Create a session-local goal to track progress, target dates, and bigger-picture focus.
      </p>
      <Button className="mt-4" onClick={onCreateGoal}>
        <Plus aria-hidden="true" className="mr-2 size-4" />
        Create goal
      </Button>
    </div>
  );
}

function GoalCard({
  goal,
  onProgressChange,
  onStatusChange,
}: {
  goal: Goal;
  onProgressChange: (goal: Goal, progress: number) => void;
  onStatusChange: (goal: Goal, status: GoalStatus) => void;
}) {
  const badgeTone = goalStatusTone[goal.status];
  const progressBarClassName =
    goal.status === 'completed'
      ? 'bg-[var(--success)]'
      : goal.status === 'paused'
        ? 'bg-[var(--warning)]'
        : 'bg-[var(--primary)]';

  return (
    <Card className="space-y-5" variant={goal.status === 'completed' ? 'subtle' : 'default'}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{goal.period}</Badge>
            <Badge tone={badgeTone}>{formatGoalStatusLabel(goal.status)}</Badge>
          </div>
          <div>
            <h3 className="text-lg font-bold">{goal.title}</h3>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{goal.description}</p>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 lg:min-w-48">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
            Target date
          </p>
          <p className="mt-1 text-sm font-semibold">{formatGoalTargetDate(goal.targetDate)}</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {formatGoalDeadlineLabel(goal.targetDate)}
          </p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Progress</p>
              <span className="text-sm font-semibold">{goal.progress}%</span>
            </div>
            <div
              aria-label={`${goal.title} progress`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={goal.progress}
              className="h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]"
              role="progressbar"
            >
              <div
                className={cn('h-full rounded-full transition-[width]', progressBarClassName)}
                style={{ width: `${goal.progress}%` }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`goal-progress-range-${goal.id}`}>
              Update progress
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                className="h-2 w-full cursor-pointer accent-[var(--primary)]"
                id={`goal-progress-range-${goal.id}`}
                max={100}
                min={0}
                onChange={(event) =>
                  onProgressChange(goal, Number.parseInt(event.target.value, 10) || 0)
                }
                step={5}
                type="range"
                value={goal.progress}
              />
              <div className="flex gap-2 sm:shrink-0">
                <Button
                  aria-label={`Decrease ${goal.title} progress by 10 percent`}
                  onClick={() => onProgressChange(goal, Math.max(goal.progress - 10, 0))}
                  variant="secondary"
                >
                  -10%
                </Button>
                <Button
                  aria-label={`Increase ${goal.title} progress by 10 percent`}
                  onClick={() => onProgressChange(goal, Math.min(goal.progress + 10, 100))}
                  variant="secondary"
                >
                  +10%
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Status</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Move between active, paused, and completed without leaving the page.
            </p>
          </div>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label={`Change ${goal.title} status`}
          >
            {GOAL_STATUS_VALUES.map((status) => (
              <GoalStatusButton
                active={goal.status === status}
                key={status}
                onClick={() => onStatusChange(goal, status)}
                status={status}
              />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function GoalsPage() {
  const goals = useGoals();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const updateGoalProgress = useUpdateGoalProgress();
  const updateGoalStatus = useUpdateGoalStatus();
  const composerRef = useRef<HTMLDivElement | null>(null);

  const [formValues, setFormValues] = useState<GoalEditorValues>(() => createDefaultGoalValues());

  const sortedGoals = useMemo(() => sortGoals(goals), [goals]);
  const activeGoalCount = sortedGoals.filter((goal) => goal.status === 'active').length;
  const pausedGoalCount = sortedGoals.filter((goal) => goal.status === 'paused').length;
  const completedGoalCount = sortedGoals.filter((goal) => goal.status === 'completed').length;
  const averageProgress =
    sortedGoals.length === 0
      ? 0
      : Math.round(
          sortedGoals.reduce((progressTotal, goal) => progressTotal + goal.progress, 0) /
            sortedGoals.length,
        );
  const nextTargetGoal =
    sortedGoals.find((goal) => goal.status !== 'completed') ?? sortedGoals[0] ?? null;

  function focusComposer() {
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetForm() {
    setFormValues(createDefaultGoalValues());
  }

  function handleCreateGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const goalInput = toGoalInput(formValues);

    if (!goalInput.title || !goalInput.description || !goalInput.period || !goalInput.targetDate) {
      return;
    }

    createGoal(goalInput);
    resetForm();
  }

  function handleProgressChange(goal: Goal, progress: number) {
    if (goal.status === 'completed' && progress < 100) {
      updateGoal(goal.id, { progress, status: 'active' });
      return;
    }

    updateGoalProgress(goal.id, progress);
  }

  function handleStatusChange(goal: Goal, status: GoalStatus) {
    if (status === 'completed') {
      updateGoalStatus(goal.id, status);
      return;
    }

    if (goal.status === 'completed' && goal.progress >= 100) {
      updateGoal(goal.id, { status, progress: 95 });
      return;
    }

    updateGoalStatus(goal.id, status);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <section className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <Badge tone="accent">Phase 9 · Goals</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Goals</h1>
          <p className="mt-2 max-w-2xl text-[var(--muted-foreground)]">
            Track longer arcs separately from tasks with progress controls, target dates, and
            session-local status updates.
          </p>
        </div>
        <Button onClick={focusComposer}>
          <Plus aria-hidden="true" className="mr-2 size-4" />
          New goal
        </Button>
      </section>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="space-y-3" variant="subtle">
          <div className="flex items-center gap-3">
            <GoalIcon aria-hidden="true" className="size-5 text-[var(--primary)]" />
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Active focus</p>
              <p className="text-2xl font-bold">{activeGoalCount}</p>
            </div>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            {activeGoalCount === 0
              ? 'No active goals are in play right now.'
              : `${activeGoalCount} goal${activeGoalCount === 1 ? '' : 's'} currently moving forward.`}
          </p>
        </Card>

        <Card className="space-y-3" variant="subtle">
          <div className="flex items-center gap-3">
            <CalendarClock aria-hidden="true" className="size-5 text-[var(--accent)]" />
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Next target</p>
              <p className="text-2xl font-bold">
                {nextTargetGoal ? format(parseISO(nextTargetGoal.targetDate), 'MMM d') : '—'}
              </p>
            </div>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            {nextTargetGoal
              ? `${nextTargetGoal.title} · ${formatGoalDeadlineLabel(nextTargetGoal.targetDate)}`
              : 'Add a goal to start tracking dates.'}
          </p>
        </Card>

        <Card className="space-y-3" variant="subtle">
          <div className="flex items-center gap-3">
            <CheckCircle2 aria-hidden="true" className="size-5 text-[var(--success)]" />
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Completion pulse</p>
              <p className="text-2xl font-bold">{averageProgress}%</p>
            </div>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            {completedGoalCount === 0
              ? `${pausedGoalCount} paused goal${pausedGoalCount === 1 ? '' : 's'} and no completions yet.`
              : `${completedGoalCount} completed goal${completedGoalCount === 1 ? '' : 's'} captured in this session.`}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <div className="space-y-6">
          <Card>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Goal board</h2>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {sortedGoals.length === 0
                    ? 'No goals created yet.'
                    : `${sortedGoals.length} goal${sortedGoals.length === 1 ? '' : 's'} in view with inline progress and status controls.`}
                </p>
              </div>
              <Badge tone={completedGoalCount > 0 ? 'success' : 'accent'}>
                {completedGoalCount} completed
              </Badge>
            </div>

            {sortedGoals.length === 0 ? (
              <GoalsEmptyState onCreateGoal={focusComposer} />
            ) : (
              <ul className="space-y-4">
                {sortedGoals.map((goal) => (
                  <li key={goal.id}>
                    <GoalCard
                      goal={goal}
                      onProgressChange={handleProgressChange}
                      onStatusChange={handleStatusChange}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <div ref={composerRef}>
            <Card>
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <Badge tone="neutral">Goal composer</Badge>
                  <h2 className="mt-3 text-lg font-bold">Create a goal</h2>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    Add a longer-running objective with a target date, starting progress, and an
                    immediate status.
                  </p>
                </div>
                <Sparkles aria-hidden="true" className="size-5 text-[var(--muted-foreground)]" />
              </div>

              <form className="space-y-4" onSubmit={handleCreateGoal}>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="goal-title">
                    Title
                  </label>
                  <Input
                    id="goal-title"
                    onChange={(event) =>
                      setFormValues((current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="Run 50km this month"
                    required
                    value={formValues.title}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="goal-description">
                    Description
                  </label>
                  <textarea
                    className={controlClassName}
                    id="goal-description"
                    onChange={(event) =>
                      setFormValues((current) => ({ ...current, description: event.target.value }))
                    }
                    placeholder="Add context, success criteria, or the habit you want to reinforce"
                    required
                    rows={4}
                    value={formValues.description}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="goal-period">
                      Period
                    </label>
                    <Input
                      id="goal-period"
                      onChange={(event) =>
                        setFormValues((current) => ({ ...current, period: event.target.value }))
                      }
                      placeholder="August focus"
                      required
                      value={formValues.period}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="goal-target-date">
                      Target date
                    </label>
                    <Input
                      id="goal-target-date"
                      onChange={(event) =>
                        setFormValues((current) => ({ ...current, targetDate: event.target.value }))
                      }
                      required
                      type="date"
                      value={formValues.targetDate}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-[0.8fr_1.2fr]">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="goal-progress-input">
                      Starting progress
                    </label>
                    <Input
                      id="goal-progress-input"
                      max={100}
                      min={0}
                      onChange={(event) =>
                        setFormValues((current) => ({
                          ...current,
                          progress: Math.max(
                            0,
                            Math.min(100, Number.parseInt(event.target.value, 10) || 0),
                          ),
                        }))
                      }
                      type="number"
                      value={formValues.progress}
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Status</p>
                    <div
                      className="flex flex-wrap gap-2"
                      role="group"
                      aria-label="Choose goal status"
                    >
                      {GOAL_STATUS_VALUES.map((status) => (
                        <GoalStatusButton
                          active={formValues.status === status}
                          key={status}
                          onClick={() => setFormValues((current) => ({ ...current, status }))}
                          status={status}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <Button type="submit">Create goal</Button>
                  <Button onClick={resetForm} type="button" variant="secondary">
                    Reset
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          <Card variant="accent">
            <h2 className="text-lg font-bold">Session-local only</h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Goal changes live in the local store for this session. Refreshing restores the
              validated fixture set.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
