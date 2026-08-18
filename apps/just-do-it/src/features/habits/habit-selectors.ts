import {
  differenceInCalendarDays,
  format,
  parseISO,
  startOfDay,
  startOfWeek,
  subDays,
  subWeeks,
} from 'date-fns';

import type { Habit, HabitCompletion } from './types';

const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

export function toHabitDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function selectCompletionDatesForHabit(
  completions: readonly HabitCompletion[],
  habitId: string,
): Set<string> {
  const completionDates = new Set<string>();

  for (const completion of completions) {
    if (completion.habitId === habitId) {
      completionDates.add(completion.date);
    }
  }

  return completionDates;
}

export function isHabitCompletedOn(
  completions: readonly HabitCompletion[],
  habitId: string,
  dateKey: string,
): boolean {
  return completions.some(
    (completion) => completion.habitId === habitId && completion.date === dateKey,
  );
}

export function selectHabitCompletionsByDate(
  completions: readonly HabitCompletion[],
): Map<string, string[]> {
  const completionsByDate = new Map<string, string[]>();

  for (const completion of completions) {
    const existingHabitIds = completionsByDate.get(completion.date);

    if (existingHabitIds) {
      existingHabitIds.push(completion.habitId);
      continue;
    }

    completionsByDate.set(completion.date, [completion.habitId]);
  }

  return completionsByDate;
}

function countCompletionsByWeek(completionDates: ReadonlySet<string>): Map<string, number> {
  const countsByWeek = new Map<string, number>();

  for (const dateKey of completionDates) {
    const weekKey = toHabitDateKey(startOfWeek(parseISO(dateKey), WEEK_OPTIONS));
    countsByWeek.set(weekKey, (countsByWeek.get(weekKey) ?? 0) + 1);
  }

  return countsByWeek;
}

function selectDailyStreak(completionDates: ReadonlySet<string>, now: Date): number {
  let cursor = startOfDay(now);

  // A day still in progress must not break a streak.
  if (!completionDates.has(toHabitDateKey(cursor))) {
    cursor = subDays(cursor, 1);
  }

  let streak = 0;

  while (completionDates.has(toHabitDateKey(cursor))) {
    streak += 1;
    cursor = subDays(cursor, 1);
  }

  return streak;
}

function selectWeeklyStreak(
  completionDates: ReadonlySet<string>,
  target: number,
  now: Date,
): number {
  const countsByWeek = countCompletionsByWeek(completionDates);
  const weekQualifies = (weekStart: Date): boolean =>
    (countsByWeek.get(toHabitDateKey(weekStart)) ?? 0) >= target;

  let cursor = startOfWeek(now, WEEK_OPTIONS);

  // A week still in progress must not break a streak.
  if (!weekQualifies(cursor)) {
    cursor = subWeeks(cursor, 1);
  }

  let streak = 0;

  while (weekQualifies(cursor)) {
    streak += 1;
    cursor = subWeeks(cursor, 1);
  }

  return streak;
}

export function selectCurrentStreak(
  habit: Habit,
  completions: readonly HabitCompletion[],
  now: Date = new Date(),
): number {
  const completionDates = selectCompletionDatesForHabit(completions, habit.id);

  return habit.frequency === 'daily'
    ? selectDailyStreak(completionDates, now)
    : selectWeeklyStreak(completionDates, habit.target, now);
}

function selectLongestRun(sortedDateKeys: readonly string[], stepDays: number): number {
  if (sortedDateKeys.length === 0) return 0;

  let longestRun = 1;
  let currentRun = 1;

  for (let index = 1; index < sortedDateKeys.length; index += 1) {
    const previousDate = parseISO(sortedDateKeys[index - 1]);
    const currentDate = parseISO(sortedDateKeys[index]);

    currentRun =
      differenceInCalendarDays(currentDate, previousDate) === stepDays ? currentRun + 1 : 1;

    if (currentRun > longestRun) {
      longestRun = currentRun;
    }
  }

  return longestRun;
}

export function selectLongestStreak(habit: Habit, completions: readonly HabitCompletion[]): number {
  const completionDates = selectCompletionDatesForHabit(completions, habit.id);

  if (habit.frequency === 'daily') {
    return selectLongestRun([...completionDates].sort(), 1);
  }

  const qualifyingWeekKeys = [...countCompletionsByWeek(completionDates).entries()]
    .filter(([, completionCount]) => completionCount >= habit.target)
    .map(([weekKey]) => weekKey)
    .sort();

  return selectLongestRun(qualifyingWeekKeys, 7);
}

export function selectCompletionRate(
  habit: Habit,
  completions: readonly HabitCompletion[],
  now: Date = new Date(),
  windowDays = 30,
): number {
  const completionDates = selectCompletionDatesForHabit(completions, habit.id);
  if (completionDates.size === 0) return 0;

  const today = startOfDay(now);
  const windowStart = subDays(today, windowDays - 1);
  const createdAt = startOfDay(parseISO(habit.createdAt));
  const eligibleStart = createdAt > windowStart ? createdAt : windowStart;
  const eligibleDays = Math.max(1, differenceInCalendarDays(today, eligibleStart) + 1);

  let completedInWindow = 0;

  for (const dateKey of completionDates) {
    const date = startOfDay(parseISO(dateKey));
    if (date >= eligibleStart && date <= today) {
      completedInWindow += 1;
    }
  }

  if (habit.frequency === 'daily') {
    return Math.min(1, completedInWindow / eligibleDays);
  }

  const eligibleWeeks = Math.max(1, Math.ceil(eligibleDays / 7));
  return Math.min(1, completedInWindow / (habit.target * eligibleWeeks));
}

export function selectPeriodProgress(
  habit: Habit,
  completions: readonly HabitCompletion[],
  now: Date = new Date(),
): { completed: number; target: number } {
  const completionDates = selectCompletionDatesForHabit(completions, habit.id);

  if (habit.frequency === 'daily') {
    return {
      completed: completionDates.has(toHabitDateKey(startOfDay(now))) ? 1 : 0,
      target: 1,
    };
  }

  const weekKey = toHabitDateKey(startOfWeek(now, WEEK_OPTIONS));

  return {
    completed: countCompletionsByWeek(completionDates).get(weekKey) ?? 0,
    target: habit.target,
  };
}

export function selectRecentCompletionDays(
  completions: readonly HabitCompletion[],
  habitId: string,
  dayCount: number,
  now: Date = new Date(),
): { date: Date; complete: boolean }[] {
  const completionDates = selectCompletionDatesForHabit(completions, habitId);
  const today = startOfDay(now);

  return Array.from({ length: dayCount }, (_, index) => {
    const date = subDays(today, dayCount - index - 1);
    return { date, complete: completionDates.has(toHabitDateKey(date)) };
  });
}

// Temporary: still read by today-page.tsx until Task 3. Deleted in Task 4.
export function selectHabitCompletionCount(habit: Habit): number {
  return habit.days.filter(Boolean).length;
}
