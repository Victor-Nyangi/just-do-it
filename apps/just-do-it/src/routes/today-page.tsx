import { format } from 'date-fns';
import { CheckCheck, Flame, Goal, ListTodo, Sparkles } from 'lucide-react';

import { Badge, Button, Card, cn } from '@just-do-it/ui';
import { formatGoalDeadlineLabel, formatGoalStatusLabel, useGoals } from '../features/goals';
import {
  HabitDayGrid,
  isHabitCompletedOn,
  selectCurrentStreak,
  selectPeriodProgress,
  selectRecentCompletionDays,
  toHabitDateKey,
  useHabitCompletions,
  useHabits,
  useToggleHabitCompletion,
} from '../features/habits';
import {
  QuickAddField,
  TaskMetadata,
  selectTodayTaskSections,
  useOpenTaskCount,
  useTasks,
  useToggleTaskCompletion,
  type TodayTaskSectionKey,
} from '../features/tasks';

const sectionCopy: Record<
  TodayTaskSectionKey,
  {
    description: string;
    emptyLabel: string;
    title: string;
    tone: 'accent' | 'neutral' | 'warning';
  }
> = {
  overdue: {
    title: 'Overdue',
    description: 'Tackle these first to clear carried work.',
    emptyLabel: 'Nothing is overdue.',
    tone: 'warning',
  },
  today: {
    title: 'Due today',
    description: 'Scheduled for today and ready for focus.',
    emptyLabel: 'Nothing is due today.',
    tone: 'accent',
  },
  unscheduled: {
    title: 'Flexible',
    description: 'Useful wins that can fit around the day.',
    emptyLabel: 'No flexible tasks waiting.',
    tone: 'neutral',
  },
};

function getGoalTone(progress: number): 'accent' | 'neutral' | 'success' {
  if (progress >= 100) return 'success';
  if (progress > 0) return 'accent';
  return 'neutral';
}

export function TodayPage() {
  const now = new Date();
  const tasks = useTasks();
  const todaySections = selectTodayTaskSections(tasks, now);
  const habits = useHabits();
  const goals = useGoals();
  const openTaskCount = useOpenTaskCount();
  const toggleTaskCompletion = useToggleTaskCompletion();
  const toggleHabitCompletion = useToggleHabitCompletion();

  const overdueCount = todaySections[0]?.tasks.length ?? 0;
  const todayCount = todaySections[1]?.tasks.length ?? 0;
  const unscheduledCount = todaySections[2]?.tasks.length ?? 0;
  const actionableTaskCount = overdueCount + todayCount + unscheduledCount;
  const completions = useHabitCompletions();
  const todayKey = toHabitDateKey(now);
  const checkedHabitsTodayCount = habits.filter((habit) =>
    isHabitCompletedOn(completions, habit.id, todayKey),
  ).length;
  const primaryGoal = goals[0] ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <section className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <Badge tone="accent">Today dashboard</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {format(now, 'EEEE, MMMM d')}
          </h1>
          <p className="mt-2 max-w-2xl text-[var(--muted-foreground)]">
            {actionableTaskCount === 0
              ? 'No actionable tasks remain across overdue, due-today, or flexible work.'
              : `${actionableTaskCount} actionable task${actionableTaskCount === 1 ? '' : 's'} to guide the day.`}
          </p>
        </div>
        <Badge tone={openTaskCount > actionableTaskCount ? 'neutral' : 'accent'}>
          {openTaskCount} open overall
        </Badge>
      </section>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="space-y-3" variant="subtle">
          <div className="flex items-center gap-3">
            <ListTodo aria-hidden="true" className="size-5 text-[var(--warning)]" />
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Needs attention first</p>
              <p className="text-2xl font-bold">{overdueCount}</p>
            </div>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            {overdueCount === 0
              ? 'No carry-over tasks.'
              : `${todayCount} due today and ${unscheduledCount} flexible next.`}
          </p>
        </Card>

        <Card className="space-y-3" variant="subtle">
          <div className="flex items-center gap-3">
            <Flame aria-hidden="true" className="size-5 text-[var(--accent)]" />
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Habit check-ins</p>
              <p className="text-2xl font-bold">
                {checkedHabitsTodayCount}/{habits.length}
              </p>
            </div>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            {habits.length === 0
              ? 'No habits tracked yet.'
              : `${habits.length - checkedHabitsTodayCount} habit${habits.length - checkedHabitsTodayCount === 1 ? '' : 's'} still open for today.`}
          </p>
        </Card>

        <Card className="space-y-3" variant="subtle">
          <div className="flex items-center gap-3">
            <Goal aria-hidden="true" className="size-5 text-[var(--primary)]" />
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Primary goal progress</p>
              <p className="text-2xl font-bold">{primaryGoal ? `${primaryGoal.progress}%` : '—'}</p>
            </div>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            {primaryGoal
              ? formatGoalDeadlineLabel(primaryGoal.targetDate)
              : 'No goals in view yet.'}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-6">
          <Card>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Today</h2>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Clear lanes for what needs attention right now.
                </p>
              </div>
              <Badge tone={actionableTaskCount === 0 ? 'success' : 'accent'}>
                {actionableTaskCount} actionable
              </Badge>
            </div>

            {actionableTaskCount === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--success-subtle)] text-[var(--success)]">
                  <CheckCheck aria-hidden="true" className="size-6" />
                </div>
                <h3 className="mt-4 text-lg font-bold">No actionable tasks remain</h3>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                  You&apos;re clear on overdue, due-today, and unscheduled work. Add a new focus
                  item below or visit Tasks for upcoming plans.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {todaySections.map((section) => {
                  const copy = sectionCopy[section.key];

                  return (
                    <section key={section.key}>
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                              {copy.title}
                            </h3>
                            <Badge tone={copy.tone}>{section.tasks.length}</Badge>
                          </div>
                          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                            {section.tasks.length === 0 ? copy.emptyLabel : copy.description}
                          </p>
                        </div>
                      </div>

                      {section.tasks.length > 0 ? (
                        <ul className="space-y-3">
                          {section.tasks.map((task) => {
                            return (
                              <li key={task.id}>
                                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                                  <div className="flex items-start gap-3">
                                    <button
                                      aria-label={`Complete ${task.title}`}
                                      className={cn(
                                        'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2',
                                        task.status === 'in_progress'
                                          ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]'
                                          : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
                                      )}
                                      onClick={() => toggleTaskCompletion(task.id)}
                                      type="button"
                                    >
                                      {task.status === 'in_progress' ? (
                                        <span className="size-2 rounded-full bg-current" />
                                      ) : null}
                                    </button>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                          <h4 className="text-sm font-semibold">{task.title}</h4>
                                          {task.description ? (
                                            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                                              {task.description}
                                            </p>
                                          ) : null}
                                        </div>
                                        <Badge
                                          tone={
                                            task.status === 'in_progress' ? 'accent' : 'neutral'
                                          }
                                        >
                                          {task.status === 'in_progress' ? 'In progress' : 'Ready'}
                                        </Badge>
                                      </div>

                                      <div className="mt-3">
                                        <TaskMetadata
                                          showDueDate={section.key !== 'unscheduled'}
                                          showRecurrence={task.recurrence !== 'none'}
                                          task={task}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <div className="mb-4 flex items-center gap-2">
              <Sparkles aria-hidden="true" className="size-4 text-[var(--primary)]" />
              <div>
                <h2 className="font-bold">Quick add</h2>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Capture a new task into the shared task store without leaving today.
                </p>
              </div>
            </div>

            <QuickAddField />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Habit check-in</h2>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Toggle today&apos;s status without creating separate local state.
                </p>
              </div>
              <Badge
                tone={
                  checkedHabitsTodayCount === habits.length && habits.length > 0
                    ? 'success'
                    : 'accent'
                }
              >
                {checkedHabitsTodayCount}/{habits.length} today
              </Badge>
            </div>

            {habits.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                No habits are being tracked yet.
              </p>
            ) : (
              <ul className="space-y-4">
                {habits.map((habit) => {
                  const completedToday = isHabitCompletedOn(completions, habit.id, todayKey);
                  const recentDays = selectRecentCompletionDays(completions, habit.id, 5, now);
                  const currentStreak = selectCurrentStreak(habit, completions, now);
                  const periodProgress = selectPeriodProgress(habit, completions, now);

                  return (
                    <li key={habit.id}>
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold">{habit.label}</h3>
                              <Badge tone={completedToday ? 'success' : 'neutral'}>
                                {completedToday ? 'Checked in' : 'Open'}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                              {currentStreak > 0
                                ? `${currentStreak} ${habit.frequency === 'daily' ? 'day' : 'week'}${currentStreak === 1 ? '' : 's'} running`
                                : 'No streak yet'}
                              {' · '}
                              {periodProgress.completed}/{periodProgress.target}{' '}
                              {habit.frequency === 'daily' ? 'today' : 'this week'}
                            </p>
                          </div>

                          <Button
                            aria-label={
                              completedToday
                                ? `Mark ${habit.label} incomplete for today`
                                : `Mark ${habit.label} complete for today`
                            }
                            aria-pressed={completedToday}
                            className="sm:self-start"
                            onClick={() => toggleHabitCompletion(habit.id, todayKey)}
                            variant={completedToday ? 'accent' : 'secondary'}
                          >
                            {completedToday ? 'Undo today' : 'Check in'}
                          </Button>
                        </div>

                        <div className="mt-4">
                          <HabitDayGrid days={recentDays} highlightDateKey={todayKey} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card variant="accent">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Goal progress</h2>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Keep the bigger picture visible while you work the day.
                </p>
              </div>
              <Badge tone={primaryGoal ? getGoalTone(primaryGoal.progress) : 'neutral'}>
                {primaryGoal ? primaryGoal.period : 'No goal'}
              </Badge>
            </div>

            {goals.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                No goals are active right now.
              </p>
            ) : (
              <ul className="space-y-4">
                {goals.map((goal) => (
                  <li key={goal.id}>
                    <div className="rounded-xl border border-white/50 bg-white/60 p-4 backdrop-blur dark:border-white/10 dark:bg-black/10">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold">{goal.title}</h3>
                          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                            {goal.description}
                          </p>
                        </div>
                        <Badge tone={getGoalTone(goal.progress)}>{goal.progress}%</Badge>
                      </div>

                      <div className="mt-4">
                        <div
                          aria-label={`${goal.title} progress`}
                          aria-valuemax={100}
                          aria-valuemin={0}
                          aria-valuenow={goal.progress}
                          className="h-2 overflow-hidden rounded-full bg-white/70 dark:bg-white/10"
                          role="progressbar"
                        >
                          <div
                            className="h-full rounded-full bg-[var(--primary)]"
                            style={{ width: `${goal.progress}%` }}
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[var(--muted-foreground)]">
                          <span>{formatGoalStatusLabel(goal.status)}</span>
                          <span>{formatGoalDeadlineLabel(goal.targetDate)}</span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
