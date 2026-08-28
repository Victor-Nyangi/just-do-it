import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  Goal as GoalIcon,
  ListTodo,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge, Button, Card, cn } from '@just-do-it/ui';
import {
  countHabitCheckInsInMonth,
  createAgendaItems,
  createCalendarIndicators,
  createGoalTargets,
  createHabitActivityMap,
  createMonthSelection,
  createTaskMap,
  getDayButtonLabel,
  getIndicatorsForDate,
  pluralize,
  toIsoDateKey,
  type AgendaItem,
  type AgendaItemKind,
  type AgendaMode,
} from '../features/calendar';
import { formatGoalDeadlineLabel, useGoals } from '../features/goals';
import { useHabitCompletions, useHabits } from '../features/habits';
import {
  TaskMetadata,
  selectFilteredTasks,
  useTasks,
  useToggleTaskCompletion,
  type TaskFilters,
} from '../features/tasks';

const weekStartsOn = 1 as const;
const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const allTaskFilters: TaskFilters = {
  priority: 'all',
  category: 'all',
};

const agendaIcons: Record<AgendaItemKind, LucideIcon> = {
  task: CalendarClock,
  goal: GoalIcon,
  habit: Flame,
};

function CalendarEmptyState({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--muted-foreground)]">
        <Icon aria-hidden="true" className="size-6" />
      </div>
      <h3 className="mt-4 text-lg font-bold">{title}</h3>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">{description}</p>
    </div>
  );
}

function IndicatorChip({
  count,
  label,
  shortLabel,
  toneClassName,
}: {
  count: number;
  label: string;
  shortLabel: string;
  toneClassName: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
        toneClassName,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      <span aria-hidden="true">{shortLabel}</span>
      <span className="sr-only">
        {count} {label}
      </span>
    </span>
  );
}

function AgendaToggleButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        'rounded-md px-3 py-2 text-sm font-semibold transition-colors',
        active
          ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-sm'
          : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function AgendaItemCard({ item }: { item: AgendaItem }) {
  const Icon = agendaIcons[item.kind];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--muted-foreground)]">
          <Icon aria-hidden="true" className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={item.tone}>{item.badge}</Badge>
            <time className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
              {format(item.date, 'EEE, MMM d')}
            </time>
          </div>
          <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.description}</p>
        </div>
      </div>
    </div>
  );
}

export function CalendarPage() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const tasks = useTasks();
  const habits = useHabits();
  const completions = useHabitCompletions();
  const goals = useGoals();
  const toggleTaskCompletion = useToggleTaskCompletion();

  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [agendaMode, setAgendaMode] = useState<AgendaMode>('day');

  const tasksByDate = useMemo(() => createTaskMap(tasks), [tasks]);
  const habitActivityByDate = useMemo(
    () => createHabitActivityMap(habits, completions),
    [completions, habits],
  );
  const goalTargets = useMemo(() => createGoalTargets(goals), [goals]);
  const indicatorsByDate = useMemo(
    () => createCalendarIndicators(tasksByDate, habitActivityByDate, goalTargets),
    [goalTargets, habitActivityByDate, tasksByDate],
  );
  const agendaItems = useMemo(
    () => createAgendaItems(tasks, habitActivityByDate, goalTargets),
    [goalTargets, habitActivityByDate, tasks],
  );
  const calendarDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(visibleMonth), { weekStartsOn }),
        end: endOfWeek(endOfMonth(visibleMonth), { weekStartsOn }),
      }),
    [visibleMonth],
  );

  const selectedDateKey = toIsoDateKey(selectedDate);
  const selectedDateIndicators = getIndicatorsForDate(indicatorsByDate, selectedDate);
  const selectedDayHabitLabels = habitActivityByDate.get(selectedDateKey) ?? [];
  const selectedDayGoalTargets = goalTargets.filter((goalTarget) =>
    isSameDay(goalTarget.targetDate, selectedDate),
  );
  const selectedDayTasks = useMemo(
    () => selectFilteredTasks(tasksByDate.get(selectedDateKey) ?? [], allTaskFilters),
    [selectedDateKey, tasksByDate],
  );
  const selectedDayCompletedTaskCount = selectedDayTasks.filter(
    (task) => task.status === 'completed',
  ).length;
  const selectedDayEventCount =
    selectedDateIndicators.tasks + selectedDateIndicators.habits + selectedDateIndicators.goals;

  const visibleMonthTaskCount = useMemo(
    () =>
      tasks.filter((task) => task.dueDate && isSameMonth(parseISO(task.dueDate), visibleMonth))
        .length,
    [tasks, visibleMonth],
  );
  const visibleMonthHabitCount = useMemo(
    () => countHabitCheckInsInMonth(habitActivityByDate, visibleMonth),
    [habitActivityByDate, visibleMonth],
  );
  const visibleMonthGoalCount = useMemo(
    () =>
      goalTargets.filter((goalTarget) => isSameMonth(goalTarget.targetDate, visibleMonth)).length,
    [goalTargets, visibleMonth],
  );
  const visibleMonthEventCount =
    visibleMonthTaskCount + visibleMonthHabitCount + visibleMonthGoalCount;

  const agendaRange = useMemo(() => {
    if (agendaMode === 'day') {
      return {
        start: selectedDate,
        end: selectedDate,
      };
    }

    return {
      start: startOfWeek(selectedDate, { weekStartsOn }),
      end: endOfWeek(selectedDate, { weekStartsOn }),
    };
  }, [agendaMode, selectedDate]);

  const filteredAgendaItems = useMemo(
    () =>
      agendaItems.filter((item) =>
        isWithinInterval(item.date, {
          start: agendaRange.start,
          end: agendaRange.end,
        }),
      ),
    [agendaItems, agendaRange],
  );

  const weeklyAgendaGroups = useMemo(
    () =>
      eachDayOfInterval({
        start: agendaRange.start,
        end: agendaRange.end,
      })
        .map((day) => ({
          date: day,
          items: filteredAgendaItems.filter((item) => isSameDay(item.date, day)),
        }))
        .filter((group) => group.items.length > 0),
    [agendaRange, filteredAgendaItems],
  );

  function selectDay(day: Date) {
    const nextDay = startOfDay(day);
    setSelectedDate(nextDay);

    if (!isSameMonth(nextDay, visibleMonth)) {
      setVisibleMonth(startOfMonth(nextDay));
    }
  }

  function changeMonth(offset: number) {
    const nextMonth = addMonths(visibleMonth, offset);
    setVisibleMonth(nextMonth);
    setSelectedDate((currentSelection) => createMonthSelection(currentSelection, nextMonth));
  }

  function resetToToday() {
    setVisibleMonth(startOfMonth(today));
    setSelectedDate(today);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <section className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <Badge tone="accent">Phase 8 · Calendar</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Calendar</h1>
          <p className="mt-2 max-w-2xl text-[var(--muted-foreground)]">
            Browse due work, recent habit activity, and goal milestones in one local-first monthly
            view.
          </p>
        </div>
        <Badge tone={selectedDayEventCount > 0 ? 'accent' : 'neutral'}>
          {selectedDayEventCount === 0
            ? 'Selected day is clear'
            : `${selectedDayEventCount} calendar item${selectedDayEventCount === 1 ? '' : 's'}`}
        </Badge>
      </section>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="space-y-3" variant="subtle">
          <div className="flex items-center gap-3">
            <ListTodo aria-hidden="true" className="size-5 text-[var(--accent)]" />
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Due tasks this month</p>
              <p className="text-2xl font-bold">{visibleMonthTaskCount}</p>
            </div>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            {visibleMonthTaskCount === 0
              ? 'No tasks have due dates in this month yet.'
              : `${pluralize(visibleMonthTaskCount, 'task')} with a scheduled date in ${format(visibleMonth, 'MMMM')}.`}
          </p>
        </Card>

        <Card className="space-y-3" variant="subtle">
          <div className="flex items-center gap-3">
            <Flame aria-hidden="true" className="size-5 text-[var(--success)]" />
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Habit activity</p>
              <p className="text-2xl font-bold">{visibleMonthHabitCount}</p>
            </div>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            {visibleMonthHabitCount === 0
              ? 'No completed check-ins land in this month.'
              : `${pluralize(visibleMonthHabitCount, 'check-in')} recorded from the shared habit store.`}
          </p>
        </Card>

        <Card className="space-y-3" variant="subtle">
          <div className="flex items-center gap-3">
            <GoalIcon aria-hidden="true" className="size-5 text-[var(--primary)]" />
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Goal target dates</p>
              <p className="text-2xl font-bold">{visibleMonthGoalCount}</p>
            </div>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            {visibleMonthGoalCount === 0
              ? 'No goal targets appear in this month.'
              : `${pluralize(visibleMonthGoalCount, 'goal target')} tracked for ${format(visibleMonth, 'MMMM')}.`}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <div className="space-y-6">
          <Card>
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold">{format(visibleMonth, 'MMMM yyyy')}</h2>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Select a day to review scheduled tasks, recent habits, and goal targets.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  aria-label={`Show ${format(addMonths(visibleMonth, -1), 'MMMM yyyy')}`}
                  onClick={() => changeMonth(-1)}
                  variant="secondary"
                >
                  <ChevronLeft aria-hidden="true" className="mr-2 size-4" />
                  Prev
                </Button>
                <Button onClick={resetToToday} variant="ghost">
                  Today
                </Button>
                <Button
                  aria-label={`Show ${format(addMonths(visibleMonth, 1), 'MMMM yyyy')}`}
                  onClick={() => changeMonth(1)}
                  variant="secondary"
                >
                  Next
                  <ChevronRight aria-hidden="true" className="ml-2 size-4" />
                </Button>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2" aria-label="Calendar legend">
              <Badge tone="accent">T = due tasks</Badge>
              <Badge tone="success">H = habit activity</Badge>
              <Badge>G = goal target</Badge>
            </div>

            {visibleMonthEventCount === 0 ? (
              <div className="mb-5">
                <CalendarEmptyState
                  description={`No due tasks, habit activity, or goal targets are scheduled in ${format(visibleMonth, 'MMMM')} yet.`}
                  icon={CalendarClock}
                  title="This month is currently open"
                />
              </div>
            ) : null}

            <div
              className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]"
              role="presentation"
            >
              {weekdayLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-7 gap-2">
              {calendarDays.map((day) => {
                const isSelected = isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, visibleMonth);
                const isCurrentDay = isSameDay(day, today);
                const indicators = getIndicatorsForDate(indicatorsByDate, day);

                return (
                  <button
                    aria-current={isCurrentDay ? 'date' : undefined}
                    aria-label={getDayButtonLabel(day, indicators)}
                    className={cn(
                      'flex min-h-24 flex-col rounded-xl border p-2 text-left transition-colors sm:min-h-28',
                      isSelected
                        ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
                        : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)] hover:bg-[var(--surface-muted)]',
                      !isCurrentMonth && 'opacity-45',
                    )}
                    key={day.toISOString()}
                    onClick={() => selectDay(day)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          'inline-flex size-8 items-center justify-center rounded-full text-sm font-semibold',
                          isSelected
                            ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                            : isCurrentDay
                              ? 'bg-[var(--primary-subtle)] text-[var(--primary)]'
                              : 'text-[var(--foreground)]',
                        )}
                      >
                        {format(day, 'd')}
                      </span>
                      {isCurrentDay ? (
                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                          Today
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-auto flex flex-wrap gap-1 pt-3">
                      {indicators.tasks > 0 ? (
                        <IndicatorChip
                          count={indicators.tasks}
                          label={pluralize(indicators.tasks, 'due task')}
                          shortLabel={`${indicators.tasks}T`}
                          toneClassName="bg-[var(--accent-subtle)] text-[var(--accent)]"
                        />
                      ) : null}
                      {indicators.habits > 0 ? (
                        <IndicatorChip
                          count={indicators.habits}
                          label={pluralize(indicators.habits, 'habit check-in')}
                          shortLabel={`${indicators.habits}H`}
                          toneClassName="bg-[var(--success-subtle)] text-[var(--success)]"
                        />
                      ) : null}
                      {indicators.goals > 0 ? (
                        <IndicatorChip
                          count={indicators.goals}
                          label={pluralize(indicators.goals, 'goal target')}
                          shortLabel={`${indicators.goals}G`}
                          toneClassName="bg-[var(--primary-subtle)] text-[var(--primary)]"
                        />
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Tasks for {format(selectedDate, 'MMMM d')}</h2>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {selectedDayTasks.length === 0
                    ? 'No due tasks are scheduled on the selected day.'
                    : `${pluralize(selectedDayTasks.length, 'due task')} with inline completion controls.`}
                </p>
              </div>
              <Badge
                tone={
                  selectedDayTasks.length > 0 &&
                  selectedDayCompletedTaskCount === selectedDayTasks.length
                    ? 'success'
                    : selectedDayTasks.length > 0
                      ? 'accent'
                      : 'neutral'
                }
              >
                {selectedDayTasks.length === 0
                  ? 'No due tasks'
                  : `${selectedDayCompletedTaskCount}/${selectedDayTasks.length} complete`}
              </Badge>
            </div>

            {selectedDayTasks.length === 0 ? (
              <CalendarEmptyState
                description="Pick another date or add a due date on the Tasks page to populate this list."
                icon={ListTodo}
                title="Nothing is due here"
              />
            ) : (
              <ul className="space-y-4">
                {selectedDayTasks.map((task) => (
                  <li key={task.id}>
                    <Card className="space-y-4" variant="subtle">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-3">
                          <div>
                            <h3 className="text-base font-bold">{task.title}</h3>
                            {task.description ? (
                              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                                {task.description}
                              </p>
                            ) : null}
                          </div>
                          <TaskMetadata showDueDate={false} task={task} />
                        </div>

                        <Button
                          aria-label={
                            task.status === 'completed'
                              ? `Reopen ${task.title}`
                              : `Complete ${task.title}`
                          }
                          className="lg:self-start"
                          onClick={() => toggleTaskCompletion(task.id)}
                          variant={task.status === 'completed' ? 'accent' : 'primary'}
                        >
                          {task.status === 'completed' ? (
                            <RotateCcw aria-hidden="true" className="mr-2 size-4" />
                          ) : (
                            <CheckCircle2 aria-hidden="true" className="mr-2 size-4" />
                          )}
                          {task.status === 'completed' ? 'Reopen' : 'Complete'}
                        </Button>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card variant="subtle">
            <Badge tone={isSameDay(selectedDate, today) ? 'accent' : 'neutral'}>
              {isSameDay(selectedDate, today) ? 'Today' : 'Selected day'}
            </Badge>
            <h2 className="mt-3 text-lg font-bold">{format(selectedDate, 'EEEE, MMMM d')}</h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              {selectedDayEventCount === 0
                ? 'No tasks, habit activity, or goal targets land on this date.'
                : `${pluralize(selectedDateIndicators.tasks, 'task')}, ${pluralize(selectedDateIndicators.habits, 'habit check-in')}, and ${pluralize(selectedDateIndicators.goals, 'goal target')} are in view.`}
            </p>

            <dl className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <dt className="text-sm text-[var(--muted-foreground)]">Due tasks</dt>
                <dd className="mt-2 text-2xl font-bold">{selectedDateIndicators.tasks}</dd>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <dt className="text-sm text-[var(--muted-foreground)]">Habit activity</dt>
                <dd className="mt-2 text-2xl font-bold">{selectedDateIndicators.habits}</dd>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <dt className="text-sm text-[var(--muted-foreground)]">Goal targets</dt>
                <dd className="mt-2 text-2xl font-bold">{selectedDateIndicators.goals}</dd>
              </div>
            </dl>

            {selectedDayHabitLabels.length > 0 || selectedDayGoalTargets.length > 0 ? (
              <div className="mt-5 space-y-4">
                {selectedDayHabitLabels.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                      Habit activity
                    </h3>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                      {selectedDayHabitLabels.join(', ')}
                    </p>
                  </div>
                ) : null}

                {selectedDayGoalTargets.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                      Goal targets
                    </h3>
                    <ul className="mt-2 space-y-2">
                      {selectedDayGoalTargets.map((goalTarget) => (
                        <li key={goalTarget.id} className="text-sm text-[var(--muted-foreground)]">
                          <span className="font-semibold text-[var(--foreground)]">
                            {goalTarget.title}
                          </span>{' '}
                          · {goalTarget.progress}% complete ·{' '}
                          {formatGoalDeadlineLabel(toIsoDateKey(goalTarget.targetDate))}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Card>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Agenda</h2>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {agendaMode === 'day'
                    ? `A concise view for ${format(selectedDate, 'MMMM d')}.`
                    : `Simple week view for ${format(agendaRange.start, 'MMM d')} – ${format(agendaRange.end, 'MMM d')}.`}
                </p>
              </div>
              <div className="inline-flex rounded-lg bg-[var(--surface-muted)] p-1">
                <AgendaToggleButton
                  active={agendaMode === 'day'}
                  label="Day"
                  onClick={() => setAgendaMode('day')}
                />
                <AgendaToggleButton
                  active={agendaMode === 'week'}
                  label="Week"
                  onClick={() => setAgendaMode('week')}
                />
              </div>
            </div>

            {agendaMode === 'day' ? (
              filteredAgendaItems.length === 0 ? (
                <CalendarEmptyState
                  description="Choose another day or add task due dates to create an agenda."
                  icon={CalendarClock}
                  title="Nothing is on the daily agenda"
                />
              ) : (
                <ul className="space-y-4">
                  {filteredAgendaItems.map((item) => (
                    <li key={item.id}>
                      <AgendaItemCard item={item} />
                    </li>
                  ))}
                </ul>
              )
            ) : weeklyAgendaGroups.length === 0 ? (
              <CalendarEmptyState
                description="This week has no task deadlines, habit activity, or goal targets yet."
                icon={CalendarClock}
                title="Weekly agenda is empty"
              />
            ) : (
              <div className="space-y-5">
                {weeklyAgendaGroups.map((group) => (
                  <section key={group.date.toISOString()}>
                    <div className="mb-3 flex items-center gap-2">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                        {format(group.date, 'EEEE')}
                      </h3>
                      <Badge>{format(group.date, 'MMM d')}</Badge>
                    </div>
                    <ul className="space-y-4">
                      {group.items.map((item) => (
                        <li key={item.id}>
                          <AgendaItemCard item={item} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </Card>

          <Card variant="accent">
            <h2 className="text-lg font-bold">Session-local behavior</h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Calendar state is powered by the existing in-memory Zustand stores, so selections and
              task toggles stay local to this session without any backend work.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
