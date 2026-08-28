import {
  compareAsc,
  format,
  getDate,
  getDaysInMonth,
  getMonth,
  getYear,
  isSameMonth,
  parseISO,
  startOfDay,
} from 'date-fns';

import type { BadgeTone } from '@just-do-it/ui';
import { formatGoalDeadlineLabel, type Goal } from '../goals';
import { selectHabitCompletionsByDate, type Habit, type HabitCompletion } from '../habits';
import type { Task } from '../tasks';
import type { AgendaItem, AgendaItemKind, DayIndicators, GoalTarget } from './types';

const agendaKindOrder: Record<AgendaItemKind, number> = {
  task: 0,
  goal: 1,
  habit: 2,
};

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function toIsoDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function createEmptyDayIndicators(): DayIndicators {
  return {
    tasks: 0,
    habits: 0,
    goals: 0,
  };
}

export function createMonthSelection(currentSelection: Date, nextMonth: Date): Date {
  const nextDayOfMonth = Math.min(getDate(currentSelection), getDaysInMonth(nextMonth));

  return startOfDay(new Date(getYear(nextMonth), getMonth(nextMonth), nextDayOfMonth));
}

export function createTaskMap(tasks: readonly Task[]): Map<string, Task[]> {
  const tasksByDate = new Map<string, Task[]>();

  for (const task of tasks) {
    if (!task.dueDate) continue;

    const currentTasks = tasksByDate.get(task.dueDate);

    if (currentTasks) {
      currentTasks.push(task);
      continue;
    }

    tasksByDate.set(task.dueDate, [task]);
  }

  return tasksByDate;
}

export function createHabitActivityMap(
  habits: readonly Habit[],
  completions: readonly HabitCompletion[],
): Map<string, string[]> {
  const labelsByHabitId = new Map(habits.map((habit) => [habit.id, habit.label]));
  const habitActivityByDate = new Map<string, string[]>();

  for (const [dateKey, habitIds] of selectHabitCompletionsByDate(completions)) {
    const labels = habitIds
      .map((habitId) => labelsByHabitId.get(habitId))
      .filter((label): label is string => Boolean(label));

    if (labels.length > 0) {
      habitActivityByDate.set(dateKey, labels);
    }
  }

  return habitActivityByDate;
}

export function createGoalTargets(goals: readonly Goal[]): GoalTarget[] {
  return [...goals]
    .map((goal) => ({
      id: goal.id,
      title: goal.title,
      progress: goal.progress,
      targetDate: startOfDay(parseISO(goal.targetDate)),
    }))
    .sort((leftTarget, rightTarget) => compareAsc(leftTarget.targetDate, rightTarget.targetDate));
}

export function getTaskAgendaTone(task: Task): BadgeTone {
  if (task.status === 'completed') return 'success';
  if (task.priority === 'urgent' || task.priority === 'high') return 'warning';
  if (task.status === 'in_progress') return 'accent';

  return 'neutral';
}

export function createAgendaItems(
  tasks: readonly Task[],
  habitActivityByDate: Map<string, string[]>,
  goalTargets: readonly GoalTarget[],
  now = new Date(),
): AgendaItem[] {
  const agendaItems: AgendaItem[] = [];

  for (const task of tasks) {
    if (!task.dueDate) continue;

    agendaItems.push({
      id: `task-${task.id}`,
      kind: 'task',
      title: task.title,
      description:
        task.description ??
        `${task.priority.replace(/\b\w/gu, (character) => character.toUpperCase())} priority · ${task.category}`,
      badge:
        task.status === 'completed'
          ? 'Completed task'
          : task.status === 'in_progress'
            ? 'In progress'
            : 'Due task',
      date: parseISO(task.dueDate),
      tone: getTaskAgendaTone(task),
    });
  }

  for (const [dateKey, labels] of habitActivityByDate) {
    agendaItems.push({
      id: `habit-${dateKey}`,
      kind: 'habit',
      title: pluralize(labels.length, 'habit check-in'),
      description: labels.join(', '),
      badge: 'Habit activity',
      date: parseISO(dateKey),
      tone: 'success',
    });
  }

  for (const goalTarget of goalTargets) {
    agendaItems.push({
      id: `goal-${goalTarget.id}`,
      kind: 'goal',
      title: goalTarget.title,
      description: `${goalTarget.progress}% complete · ${formatGoalDeadlineLabel(toIsoDateKey(goalTarget.targetDate), now)}`,
      badge: 'Goal target',
      date: goalTarget.targetDate,
      tone: 'accent',
    });
  }

  return agendaItems.sort((leftItem, rightItem) => {
    const dateComparison = compareAsc(leftItem.date, rightItem.date);

    if (dateComparison !== 0) return dateComparison;

    const kindComparison = agendaKindOrder[leftItem.kind] - agendaKindOrder[rightItem.kind];

    if (kindComparison !== 0) return kindComparison;

    return leftItem.title.localeCompare(rightItem.title);
  });
}

export function createCalendarIndicators(
  tasksByDate: Map<string, Task[]>,
  habitActivityByDate: Map<string, string[]>,
  goalTargets: readonly GoalTarget[],
): Map<string, DayIndicators> {
  const indicatorsByDate = new Map<string, DayIndicators>();

  for (const [dateKey, dayTasks] of tasksByDate) {
    indicatorsByDate.set(dateKey, {
      ...createEmptyDayIndicators(),
      tasks: dayTasks.length,
    });
  }

  for (const [dateKey, labels] of habitActivityByDate) {
    const currentIndicators = indicatorsByDate.get(dateKey) ?? createEmptyDayIndicators();

    indicatorsByDate.set(dateKey, {
      ...currentIndicators,
      habits: labels.length,
    });
  }

  for (const goalTarget of goalTargets) {
    const dateKey = toIsoDateKey(goalTarget.targetDate);
    const currentIndicators = indicatorsByDate.get(dateKey) ?? createEmptyDayIndicators();

    indicatorsByDate.set(dateKey, {
      ...currentIndicators,
      goals: currentIndicators.goals + 1,
    });
  }

  return indicatorsByDate;
}

export function getIndicatorsForDate(
  indicatorsByDate: Map<string, DayIndicators>,
  date: Date,
): DayIndicators {
  return indicatorsByDate.get(toIsoDateKey(date)) ?? createEmptyDayIndicators();
}

export function countHabitCheckInsInMonth(
  habitActivityByDate: Map<string, string[]>,
  month: Date,
): number {
  let total = 0;

  for (const [dateKey, labels] of habitActivityByDate) {
    if (!isSameMonth(parseISO(dateKey), month)) continue;

    total += labels.length;
  }

  return total;
}

export function getDayButtonLabel(date: Date, indicators: DayIndicators): string {
  const parts = [format(date, 'EEEE, MMMM d, yyyy')];

  if (indicators.tasks > 0) {
    parts.push(pluralize(indicators.tasks, 'due task'));
  }

  if (indicators.habits > 0) {
    parts.push(pluralize(indicators.habits, 'habit check-in'));
  }

  if (indicators.goals > 0) {
    parts.push(pluralize(indicators.goals, 'goal target'));
  }

  if (parts.length === 1) {
    parts.push('No scheduled items');
  }

  return parts.join('. ');
}
