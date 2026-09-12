import { describe, expect, it } from 'vitest';

import { getInitialJourneyEnrollments, getInitialJourneys } from './journey-data';
import { buildDayPlan } from './journey-plan';
import {
  selectActivitiesByCategory,
  selectBookProgressForTrack,
  selectBookProgressList,
  selectCompletionsForEnrollment,
  selectDayProgress,
  selectDaySummaries,
  selectEnrolledJourney,
  selectEnrolledJourneys,
  selectJourneyStats,
} from './journey-selectors';
import type { EnrolledJourney, JourneyCompletion } from './types';

const journeys = getInitialJourneys();
const [discipline, deepWork] = journeys;
const enrollments = getInitialJourneyEnrollments();
const [enrollment] = enrollments;
const enrolled: EnrolledJourney = { enrollment, journey: discipline };

// Midday on day 5, inside the window. Midday rather than midnight so that a
// clock creeping forward in a DOM test cannot roll the date over.
const dayFive = new Date(2026, 8, 16, 12);

function planFor(dayIndex: number) {
  const plan = buildDayPlan(discipline, enrollment, dayIndex);

  if (!plan) throw new Error(`No plan for day ${dayIndex}`);

  return plan;
}

function completeActivities(activityIds: readonly string[], enrollmentId = enrollment.id) {
  return activityIds.map((activityId, index) => ({
    id: `completion-${enrollmentId}-${index}`,
    enrollmentId,
    dayIndex: Number(activityId.split('-')[1]),
    activityId,
    completedAt: '2026-09-15T09:00:00.000Z',
  })) satisfies JourneyCompletion[];
}

function completeWholeDays(dayIndexes: readonly number[]) {
  return completeActivities(
    dayIndexes.flatMap((dayIndex) => planFor(dayIndex).activities.map((a) => a.id)),
  );
}

describe('resolving an enrollment to its journey', () => {
  it('pairs an enrollment with the journey it points at', () => {
    expect(selectEnrolledJourney(journeys, enrollments, enrollment.id)).toEqual({
      enrollment,
      journey: discipline,
    });
  });

  it('resolves nothing for an unknown enrollment', () => {
    expect(selectEnrolledJourney(journeys, enrollments, 'nope')).toBeNull();
  });

  // A dangling enrollment should drop out of the list rather than render as a
  // broken card.
  it('drops an enrollment whose journey is gone', () => {
    const dangling = { ...enrollment, id: 'dangling', journeyId: 'deleted' };

    expect(selectEnrolledJourneys(journeys, [...enrollments, dangling])).toHaveLength(1);
    expect(selectEnrolledJourney(journeys, [dangling], 'dangling')).toBeNull();
  });
});

describe('selectCompletionsForEnrollment', () => {
  // Two enrollments both have a `day-1-reflection`; nothing may leak between
  // them.
  it('keeps two enrollments apart even with identical activity ids', () => {
    const completions = [
      ...completeActivities(['day-1-reflection'], 'enrollment-a'),
      ...completeActivities(['day-1-reflection'], 'enrollment-b'),
    ];

    expect(selectCompletionsForEnrollment(completions, 'enrollment-a')).toHaveLength(1);
    expect(selectCompletionsForEnrollment(completions, 'enrollment-a')[0].enrollmentId).toBe(
      'enrollment-a',
    );
  });
});

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

  it('ignores completions belonging to a different day', () => {
    expect(selectDayProgress(planFor(2), completeWholeDays([1]))).toMatchObject({
      completedCount: 0,
      complete: false,
    });
  });
});

describe('selectDaySummaries', () => {
  it('marks the day that is being lived, not just the ones behind it', () => {
    const summaries = selectDaySummaries(enrolled, [], dayFive);

    expect(summaries[4]).toMatchObject({ dayIndex: 5, status: 'in_progress', isToday: true });
  });

  it('separates a missed day from an upcoming one', () => {
    const summaries = selectDaySummaries(enrolled, [], dayFive);

    expect(summaries[0].status).toBe('missed');
    expect(summaries[5].status).toBe('upcoming');
  });

  it('grades a finished day and a half-finished one differently', () => {
    const completions = [...completeWholeDays([1]), ...completeActivities(['day-2-run-10min'])];
    const summaries = selectDaySummaries(enrolled, completions, dayFive);

    expect(summaries[0].status).toBe('complete');
    expect(summaries[1].status).toBe('partial');
  });

  it('treats every day as upcoming before the journey opens', () => {
    const summaries = selectDaySummaries(enrolled, [], new Date(2026, 7, 1, 12));

    expect(summaries.every((summary) => summary.status === 'upcoming')).toBe(true);
    expect(summaries.some((summary) => summary.isToday)).toBe(false);
  });
});

describe('selectJourneyStats', () => {
  it('counts every activity across the whole journey', () => {
    const stats = selectJourneyStats(enrolled, [], dayFive);

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
    const stats = selectJourneyStats(enrolled, completeWholeDays([1, 2, 3, 4]), dayFive);

    expect(stats.currentStreak).toBe(4);
    expect(stats.longestStreak).toBe(4);
    expect(stats.completedDayCount).toBe(4);
  });

  // The same rule the habit selectors use: checking the tracker at breakfast
  // should not report today as already lost.
  it('does not let the day in progress break the streak', () => {
    expect(selectJourneyStats(enrolled, completeWholeDays([3, 4]), dayFive).currentStreak).toBe(2);
  });

  it('extends the streak through today once today is finished too', () => {
    expect(selectJourneyStats(enrolled, completeWholeDays([3, 4, 5]), dayFive).currentStreak).toBe(
      3,
    );
  });

  it('breaks the streak on a day that was genuinely missed', () => {
    const stats = selectJourneyStats(enrolled, completeWholeDays([1, 2, 4]), dayFive);

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
    const stats = selectJourneyStats(enrolled, completions, dayFive);
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

  // A reading-only journey should not report an empty physical row.
  it('omits a category the journey never schedules', () => {
    const deepWorkEnrolled: EnrolledJourney = {
      enrollment: { ...enrollment, id: 'deep', journeyId: deepWork.id },
      journey: deepWork,
    };
    const stats = selectJourneyStats(deepWorkEnrolled, [], dayFive);

    expect(stats.categoryCounts.map((entry) => entry.category)).toEqual([
      'technical_reading',
      'reflection',
    ]);
    expect(stats.totalActivityCount).toBe(60);
  });

  it('reports no streak and no elapsed days before the journey opens', () => {
    expect(selectJourneyStats(enrolled, [], new Date(2026, 7, 1, 12))).toMatchObject({
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
      enrolled,
      completeActivities(['day-1-technical-reading']),
      dayFive,
    );

    expect(progress.find((item) => item.book.id === 'micro-frontends-in-action')).toMatchObject({
      sessionsCompleted: 1,
      pagesRead: 10,
      progress: 3,
    });
  });

  it('leaves an unread book at zero', () => {
    const progress = selectBookProgressList(enrolled, [], dayFive);

    expect(progress.every((entry) => entry.progress === 0)).toBe(true);
    expect(progress.every((entry) => entry.sessionsScheduled > 0)).toBe(true);
  });

  // A short book can be scheduled more often than it has pages for. Letting
  // that run past 100% would make the bar lie.
  it('caps pages read at the length of the book', () => {
    const shortJourney = {
      ...discipline,
      books: [
        { ...discipline.books[0], id: 'short', title: 'Short', pageCount: 10 },
        discipline.books.find((book) => book.track === 'growth')!,
      ],
    };
    const progress = selectBookProgressList(
      { enrollment, journey: shortJourney },
      completeActivities([
        'day-1-technical-reading',
        'day-2-technical-reading',
        'day-3-technical-reading',
      ]),
      dayFive,
    );

    expect(progress.find((item) => item.book.id === 'short')).toMatchObject({
      sessionsCompleted: 3,
      pagesRead: 10,
      progress: 100,
    });
  });

  it('points at the next still-open session from today onwards', () => {
    for (const entry of selectBookProgressList(enrolled, [], dayFive)) {
      expect(entry.nextScheduledDayIndex).not.toBeNull();
      expect(entry.nextScheduledDayIndex).toBeGreaterThanOrEqual(5);
    }
  });

  it('splits the list by track', () => {
    const progress = selectBookProgressList(enrolled, [], dayFive);

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
