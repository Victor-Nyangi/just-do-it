import { describe, expect, it } from 'vitest';

import {
  isHabitCompletedOn,
  selectCompletionRate,
  selectCurrentStreak,
  selectHabitCompletionsByDate,
  selectLongestStreak,
  selectPeriodProgress,
  selectRecentCompletionDays,
  toHabitDateKey,
} from './habit-selectors';
import type { Habit, HabitCompletion } from './types';

const now = new Date(2026, 7, 18); // Tuesday 2026-08-18, local time

const dailyHabit: Habit = {
  id: 'reading',
  label: 'Reading',
  frequency: 'daily',
  target: 1,
  createdAt: '2026-01-01',
  days: [],
};

const weeklyHabit: Habit = {
  id: 'workout',
  label: 'Workout',
  frequency: 'weekly',
  target: 4,
  createdAt: '2026-01-01',
  days: [],
};

function completionsOn(habitId: string, dates: readonly string[]): HabitCompletion[] {
  return dates.map((date) => ({ id: `${habitId}-${date}`, habitId, date }));
}

describe('toHabitDateKey', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(toHabitDateKey(now)).toBe('2026-08-18');
  });
});

describe('isHabitCompletedOn', () => {
  const completions = completionsOn('reading', ['2026-08-17']);

  it('is true for a recorded day', () => {
    expect(isHabitCompletedOn(completions, 'reading', '2026-08-17')).toBe(true);
  });

  it('is false for an unrecorded day', () => {
    expect(isHabitCompletedOn(completions, 'reading', '2026-08-18')).toBe(false);
  });

  it('is false for another habit on a recorded day', () => {
    expect(isHabitCompletedOn(completions, 'workout', '2026-08-17')).toBe(false);
  });
});

describe('selectHabitCompletionsByDate', () => {
  it('groups habit ids under each date', () => {
    const completions = [
      ...completionsOn('reading', ['2026-08-17', '2026-08-18']),
      ...completionsOn('workout', ['2026-08-17']),
    ];

    const byDate = selectHabitCompletionsByDate(completions);

    expect(byDate.get('2026-08-17')).toEqual(['reading', 'workout']);
    expect(byDate.get('2026-08-18')).toEqual(['reading']);
    expect(byDate.has('2026-08-16')).toBe(false);
  });

  it('returns an empty map for no completions', () => {
    expect(selectHabitCompletionsByDate([]).size).toBe(0);
  });
});

describe('selectCurrentStreak — daily', () => {
  it('counts an unbroken run ending today', () => {
    const completions = completionsOn('reading', ['2026-08-16', '2026-08-17', '2026-08-18']);

    expect(selectCurrentStreak(dailyHabit, completions, now)).toBe(3);
  });

  it('applies grace when today is not yet complete', () => {
    const completions = completionsOn('reading', ['2026-08-15', '2026-08-16', '2026-08-17']);

    expect(selectCurrentStreak(dailyHabit, completions, now)).toBe(3);
  });

  it('is zero when both today and yesterday are missed', () => {
    const completions = completionsOn('reading', ['2026-08-14', '2026-08-15', '2026-08-16']);

    expect(selectCurrentStreak(dailyHabit, completions, now)).toBe(0);
  });

  it('counts a single completed day', () => {
    expect(selectCurrentStreak(dailyHabit, completionsOn('reading', ['2026-08-18']), now)).toBe(1);
  });

  it('is zero with no completions', () => {
    expect(selectCurrentStreak(dailyHabit, [], now)).toBe(0);
  });

  it('ignores completions belonging to another habit', () => {
    expect(selectCurrentStreak(dailyHabit, completionsOn('workout', ['2026-08-18']), now)).toBe(0);
  });
});

describe('selectCurrentStreak — weekly', () => {
  // Monday-first weeks. 2026-08-17 is a Monday, so the current week is 08-17..08-23.
  it('counts consecutive weeks that reach target, with the current week in progress', () => {
    const completions = completionsOn('workout', [
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06', // week of 08-03: 4
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13', // week of 08-10: 4
      '2026-08-17', // current week: 1, below target
    ]);

    expect(selectCurrentStreak(weeklyHabit, completions, now)).toBe(2);
  });

  it('counts the current week once it reaches target', () => {
    const completions = completionsOn('workout', [
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
    ]);

    expect(selectCurrentStreak(weeklyHabit, completions, now)).toBe(2);
  });

  it('stops at a week that misses target', () => {
    const completions = completionsOn('workout', [
      '2026-07-27',
      '2026-07-28',
      '2026-07-29',
      '2026-07-30', // week of 07-27: 4
      '2026-08-03',
      '2026-08-04',
      '2026-08-05', // week of 08-03: 3, misses
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13', // week of 08-10: 4
    ]);

    expect(selectCurrentStreak(weeklyHabit, completions, now)).toBe(1);
  });

  it('is zero when the most recent complete week misses target', () => {
    const completions = completionsOn('workout', ['2026-08-10', '2026-08-11']);

    expect(selectCurrentStreak(weeklyHabit, completions, now)).toBe(0);
  });
});

describe('selectLongestStreak', () => {
  it('finds the longest daily run even when it is not the current one', () => {
    const completions = completionsOn('reading', [
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-04',
      '2026-07-05',
      '2026-08-17',
      '2026-08-18',
    ]);

    expect(selectLongestStreak(dailyHabit, completions)).toBe(5);
  });

  it('returns the current run when it is the longest', () => {
    const completions = completionsOn('reading', ['2026-08-16', '2026-08-17', '2026-08-18']);

    expect(selectLongestStreak(dailyHabit, completions)).toBe(3);
  });

  it('applies no grace — an in-progress period is not special', () => {
    const completions = completionsOn('reading', ['2026-08-17']);

    expect(selectLongestStreak(dailyHabit, completions)).toBe(1);
  });

  it('counts consecutive qualifying weeks', () => {
    const completions = completionsOn('workout', [
      '2026-07-27',
      '2026-07-28',
      '2026-07-29',
      '2026-07-30',
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-10',
      '2026-08-11', // below target, breaks the run
    ]);

    expect(selectLongestStreak(weeklyHabit, completions)).toBe(2);
  });

  it('is zero with no completions', () => {
    expect(selectLongestStreak(dailyHabit, [])).toBe(0);
    expect(selectLongestStreak(weeklyHabit, [])).toBe(0);
  });
});

describe('selectCompletionRate', () => {
  it('is one when every day in the window is complete', () => {
    const dates = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(2026, 7, 18 - index);
      return toHabitDateKey(date);
    });

    expect(selectCompletionRate(dailyHabit, completionsOn('reading', dates), now)).toBe(1);
  });

  it('is zero with no completions', () => {
    expect(selectCompletionRate(dailyHabit, [], now)).toBe(0);
  });

  it('clamps the window to createdAt', () => {
    // Created three days ago, complete on all three days -> 1, not 3/30.
    const recentHabit: Habit = { ...dailyHabit, createdAt: '2026-08-16' };
    const completions = completionsOn('reading', ['2026-08-16', '2026-08-17', '2026-08-18']);

    expect(selectCompletionRate(recentHabit, completions, now)).toBe(1);
  });

  it('caps at one when a weekly habit overshoots its target', () => {
    // 28 consecutive days against a target of 4/week over a 30-day window:
    // the denominator is 4 x ceil(30/7) = 20, so the raw ratio is 1.4.
    const dates = Array.from({ length: 28 }, (_, index) =>
      toHabitDateKey(new Date(2026, 7, 18 - index)),
    );

    expect(selectCompletionRate(weeklyHabit, completionsOn('workout', dates), now)).toBe(1);
  });

  it('divides by one rather than zero for a habit created today', () => {
    const brandNewHabit: Habit = { ...dailyHabit, createdAt: '2026-08-18' };

    expect(selectCompletionRate(brandNewHabit, [], now)).toBe(0);
    expect(selectCompletionRate(brandNewHabit, completionsOn('reading', ['2026-08-18']), now)).toBe(
      1,
    );
  });
});

describe('selectPeriodProgress', () => {
  it('reports today for a daily habit', () => {
    expect(selectPeriodProgress(dailyHabit, completionsOn('reading', ['2026-08-18']), now)).toEqual(
      {
        completed: 1,
        target: 1,
      },
    );
  });

  it('reports zero for a daily habit not yet done today', () => {
    expect(selectPeriodProgress(dailyHabit, completionsOn('reading', ['2026-08-17']), now)).toEqual(
      {
        completed: 0,
        target: 1,
      },
    );
  });

  it('counts the current week for a weekly habit', () => {
    const completions = completionsOn('workout', ['2026-08-17', '2026-08-18', '2026-08-10']);

    expect(selectPeriodProgress(weeklyHabit, completions, now)).toEqual({
      completed: 2,
      target: 4,
    });
  });
});

describe('selectRecentCompletionDays', () => {
  it('returns the requested number of days ending today, oldest first', () => {
    const completions = completionsOn('reading', ['2026-08-16', '2026-08-18']);
    const recentDays = selectRecentCompletionDays(completions, 'reading', 3, now);

    expect(recentDays).toHaveLength(3);
    expect(recentDays.map((day) => toHabitDateKey(day.date))).toEqual([
      '2026-08-16',
      '2026-08-17',
      '2026-08-18',
    ]);
    expect(recentDays.map((day) => day.complete)).toEqual([true, false, true]);
  });

  it('returns all-incomplete days for an unknown habit', () => {
    const recentDays = selectRecentCompletionDays([], 'no-such-habit', 2, now);

    expect(recentDays.map((day) => day.complete)).toEqual([false, false]);
  });
});
