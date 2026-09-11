import { describe, expect, it } from 'vitest';

import { getInitialChallenge, getInitialChallengeBooks } from './challenge-data';
import { buildDayPlan } from './challenge-plan';
import {
  isChallengeActivityCompleted,
  selectActivitiesByCategory,
  selectBookProgressForTrack,
  selectBookProgressList,
  selectChallengeStats,
  selectCompletedActivityIdsForDay,
  selectDayProgress,
  selectDaySummaries,
} from './challenge-selectors';
import type { ChallengeCompletion } from './types';

const challenge = getInitialChallenge();
const books = getInitialChallengeBooks();

// Midday on day 5, inside the window. Midday rather than midnight so that a
// clock creeping forward in a DOM test cannot roll the date over.
const dayFive = new Date(2026, 8, 15, 12);

function planFor(dayIndex: number) {
  const plan = buildDayPlan(challenge, books, dayIndex);

  if (!plan) throw new Error(`No plan for day ${dayIndex}`);

  return plan;
}

function completeActivities(activityIds: readonly string[]): ChallengeCompletion[] {
  return activityIds.map((activityId, index) => ({
    id: `completion-${index}`,
    dayIndex: Number(activityId.split('-')[1]),
    activityId,
    completedAt: '2026-09-15T09:00:00.000Z',
  }));
}

function completeWholeDays(dayIndexes: readonly number[]): ChallengeCompletion[] {
  return completeActivities(
    dayIndexes.flatMap((dayIndex) => planFor(dayIndex).activities.map((a) => a.id)),
  );
}

describe('selectDayProgress', () => {
  it('counts nothing done on an untouched day', () => {
    expect(selectDayProgress(planFor(1), [])).toEqual({
      completedCount: 0,
      activityCount: 5,
      complete: false,
    });
  });

  it('counts a partly finished day without calling it complete', () => {
    const completions = completeActivities(['day-1-walk-1km', 'day-1-reflection']);

    expect(selectDayProgress(planFor(1), completions)).toMatchObject({
      completedCount: 2,
      complete: false,
    });
  });

  it('calls a day complete only once every activity is ticked', () => {
    expect(selectDayProgress(planFor(1), completeWholeDays([1]))).toMatchObject({
      completedCount: 5,
      activityCount: 5,
      complete: true,
    });
  });

  // Completions carry a day index, so one day's ticks must not count towards
  // another's even when the plans are the same shape.
  it('ignores completions belonging to a different day', () => {
    expect(selectDayProgress(planFor(2), completeWholeDays([1]))).toMatchObject({
      completedCount: 0,
      complete: false,
    });
  });
});

describe('selectCompletedActivityIdsForDay', () => {
  it('returns only the ids ticked on that day', () => {
    const completions = completeWholeDays([1, 2]);

    expect(selectCompletedActivityIdsForDay(completions, 1)).toEqual(
      new Set(planFor(1).activities.map((activity) => activity.id)),
    );
  });

  it('reports whether a single activity is done', () => {
    const completions = completeActivities(['day-1-walk-1km']);

    expect(isChallengeActivityCompleted(completions, 'day-1-walk-1km')).toBe(true);
    expect(isChallengeActivityCompleted(completions, 'day-1-reflection')).toBe(false);
  });
});

describe('selectDaySummaries', () => {
  it('marks the day that is being lived, not just the ones behind it', () => {
    const summaries = selectDaySummaries(challenge, books, [], dayFive);

    expect(summaries[4]).toMatchObject({ dayIndex: 5, status: 'in_progress', isToday: true });
  });

  it('separates a missed day from an upcoming one', () => {
    const summaries = selectDaySummaries(challenge, books, [], dayFive);

    expect(summaries[0].status).toBe('missed');
    expect(summaries[5].status).toBe('upcoming');
  });

  it('grades a finished day and a half-finished one differently', () => {
    const completions = [...completeWholeDays([1]), ...completeActivities(['day-2-run-10min'])];
    const summaries = selectDaySummaries(challenge, books, completions, dayFive);

    expect(summaries[0].status).toBe('complete');
    expect(summaries[1].status).toBe('partial');
  });

  // Before the challenge opens nothing has been missed, so every day should
  // read as ahead rather than as already lost.
  it('treats every day as upcoming before the challenge opens', () => {
    const summaries = selectDaySummaries(challenge, books, [], new Date(2026, 7, 1, 12));

    expect(summaries.every((summary) => summary.status === 'upcoming')).toBe(true);
    expect(summaries.some((summary) => summary.isToday)).toBe(false);
  });
});

describe('selectChallengeStats', () => {
  it('counts every activity across the whole challenge', () => {
    const stats = selectChallengeStats(challenge, books, [], dayFive);

    expect(stats.totalActivityCount).toBe(486);
    expect(stats.completedActivityCount).toBe(0);
    expect(stats).toMatchObject({
      currentDayIndex: 5,
      elapsedDayCount: 5,
      remainingDayCount: 95,
      totalDays: 100,
    });
  });

  it('counts a streak of consecutive finished days', () => {
    const stats = selectChallengeStats(challenge, books, completeWholeDays([1, 2, 3, 4]), dayFive);

    expect(stats.currentStreak).toBe(4);
    expect(stats.longestStreak).toBe(4);
    expect(stats.completedDayCount).toBe(4);
  });

  // The same rule the habit selectors use: checking the tracker at breakfast
  // should not report today as already lost.
  it('does not let the day in progress break the streak', () => {
    const stats = selectChallengeStats(challenge, books, completeWholeDays([3, 4]), dayFive);

    expect(stats.currentStreak).toBe(2);
  });

  it('extends the streak through today once today is finished too', () => {
    const stats = selectChallengeStats(challenge, books, completeWholeDays([3, 4, 5]), dayFive);

    expect(stats.currentStreak).toBe(3);
  });

  it('breaks the streak on a day that was genuinely missed', () => {
    const stats = selectChallengeStats(challenge, books, completeWholeDays([1, 2, 4]), dayFive);

    expect(stats.currentStreak).toBe(1);
    expect(stats.longestStreak).toBe(2);
  });

  it('breaks down the completed activities by category', () => {
    const completions = completeActivities([
      'day-1-walk-1km',
      'day-1-push-ups-50',
      'day-1-technical-reading',
      'day-1-reflection',
    ]);
    const stats = selectChallengeStats(challenge, books, completions, dayFive);
    const byCategory = Object.fromEntries(
      stats.categoryCounts.map((entry) => [entry.category, entry.completedCount]),
    );

    expect(byCategory).toMatchObject({
      physical: 2,
      technical_reading: 1,
      growth_reading: 0,
      reflection: 1,
    });
    expect(stats.completedActivityCount).toBe(4);
  });

  it('counts one reflection per day', () => {
    const stats = selectChallengeStats(challenge, books, [], dayFive);
    const reflection = stats.categoryCounts.find((entry) => entry.category === 'reflection');

    expect(reflection?.activityCount).toBe(100);
  });

  it('reports no streak and no elapsed days before the challenge opens', () => {
    const stats = selectChallengeStats(challenge, books, [], new Date(2026, 7, 1, 12));

    expect(stats).toMatchObject({
      currentDayIndex: null,
      elapsedDayCount: 0,
      remainingDayCount: 100,
      currentStreak: 0,
    });
  });
});

describe('selectBookProgressList', () => {
  it('turns completed reading sessions into pages and a percentage', () => {
    // Day 1's technical slot is Micro Frontends in Action, 300 pages: one
    // ten-page session is 3%.
    const progress = selectBookProgressList(
      challenge,
      books,
      completeActivities(['day-1-technical-reading']),
      dayFive,
    );
    const entry = progress.find((item) => item.book.id === 'micro-frontends-in-action');

    expect(entry).toMatchObject({ sessionsCompleted: 1, pagesRead: 10, progress: 3 });
  });

  it('leaves an unread book at zero', () => {
    const progress = selectBookProgressList(challenge, books, [], dayFive);

    expect(progress.every((entry) => entry.progress === 0)).toBe(true);
    expect(progress.every((entry) => entry.sessionsCompleted === 0)).toBe(true);
  });

  it('schedules every book at least once', () => {
    const progress = selectBookProgressList(challenge, books, [], dayFive);

    expect(progress.every((entry) => entry.sessionsScheduled > 0)).toBe(true);
  });

  // A short book can be scheduled more often than it has pages for. Letting
  // that run past 100% would make the bar lie.
  it('caps pages read at the length of the book', () => {
    const shortBook = { ...books[0], id: 'short', title: 'Short', pageCount: 10 };
    const trimmedBooks = [shortBook, books.find((book) => book.track === 'growth')!];
    const completions = completeActivities([
      'day-1-technical-reading',
      'day-2-technical-reading',
      'day-3-technical-reading',
    ]);
    const progress = selectBookProgressList(challenge, trimmedBooks, completions, dayFive);
    const entry = progress.find((item) => item.book.id === 'short');

    expect(entry).toMatchObject({ sessionsCompleted: 3, pagesRead: 10, progress: 100 });
  });

  it('points at the next still-open session from today onwards', () => {
    const progress = selectBookProgressList(challenge, books, [], dayFive);

    for (const entry of progress) {
      expect(entry.nextScheduledDayIndex).not.toBeNull();
      expect(entry.nextScheduledDayIndex).toBeGreaterThanOrEqual(5);
    }
  });

  it('splits the list by track', () => {
    const progress = selectBookProgressList(challenge, books, [], dayFive);

    expect(selectBookProgressForTrack(progress, 'technical')).toHaveLength(6);
    expect(selectBookProgressForTrack(progress, 'growth')).toHaveLength(13);
  });
});

describe('selectActivitiesByCategory', () => {
  it('groups a day in the fixed category order', () => {
    expect(selectActivitiesByCategory(planFor(1)).map((group) => group.category)).toEqual([
      'physical',
      'technical_reading',
      'growth_reading',
      'reflection',
    ]);
  });

  it('keeps every activity of a category together', () => {
    const groups = selectActivitiesByCategory(planFor(5));

    expect(groups[0].activities).toHaveLength(3);
    expect(groups.flatMap((group) => group.activities)).toHaveLength(planFor(5).activities.length);
  });
});
