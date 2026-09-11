import { buildAllDayPlans, getCurrentDayIndex } from './journey-plan';
import {
  JOURNEY_ACTIVITY_CATEGORY_VALUES,
  type EnrolledJourney,
  type Journey,
  type JourneyActivity,
  type JourneyActivityGroup,
  type JourneyBookProgress,
  type JourneyBookTrack,
  type JourneyCategoryCount,
  type JourneyCompletion,
  type JourneyDayPlan,
  type JourneyDayProgress,
  type JourneyDayStatus,
  type JourneyDaySummary,
  type JourneyEnrollment,
  type JourneyStats,
} from './types';

const READING_CATEGORIES = ['technical_reading', 'growth_reading'] as const;

export function selectEnrolledJourney(
  journeys: readonly Journey[],
  enrollments: readonly JourneyEnrollment[],
  enrollmentId: string,
): EnrolledJourney | null {
  const enrollment = enrollments.find((entry) => entry.id === enrollmentId);
  if (!enrollment) return null;

  const journey = journeys.find((entry) => entry.id === enrollment.journeyId);

  return journey ? { enrollment, journey } : null;
}

export function selectEnrolledJourneys(
  journeys: readonly Journey[],
  enrollments: readonly JourneyEnrollment[],
): EnrolledJourney[] {
  return enrollments.flatMap((enrollment) => {
    const journey = journeys.find((entry) => entry.id === enrollment.journeyId);

    return journey ? [{ enrollment, journey }] : [];
  });
}

// Completions are scoped to an enrollment, so every count below takes one.
export function selectCompletionsForEnrollment(
  completions: readonly JourneyCompletion[],
  enrollmentId: string,
): JourneyCompletion[] {
  return completions.filter((completion) => completion.enrollmentId === enrollmentId);
}

export function selectCompletedActivityIds(completions: readonly JourneyCompletion[]): Set<string> {
  return new Set(completions.map((completion) => completion.activityId));
}

export function selectCompletedActivityIdsForDay(
  completions: readonly JourneyCompletion[],
  dayIndex: number,
): Set<string> {
  const completedIds = new Set<string>();

  for (const completion of completions) {
    if (completion.dayIndex === dayIndex) {
      completedIds.add(completion.activityId);
    }
  }

  return completedIds;
}

export function isJourneyActivityCompleted(
  completions: readonly JourneyCompletion[],
  activityId: string,
): boolean {
  return completions.some((completion) => completion.activityId === activityId);
}

export function selectDayProgress(
  plan: JourneyDayPlan,
  completions: readonly JourneyCompletion[],
): JourneyDayProgress {
  const completedIds = selectCompletedActivityIdsForDay(completions, plan.dayIndex);
  const completedCount = plan.activities.filter((activity) => completedIds.has(activity.id)).length;

  return {
    completedCount,
    activityCount: plan.activities.length,
    // An empty day would otherwise read as complete. `journeySchema` refuses a
    // journey that schedules nothing at all, but a rotation entry can still be
    // empty, and "0 of 0 done" is not a win.
    complete: plan.activities.length > 0 && completedCount === plan.activities.length,
  };
}

function toDayStatus(
  progress: JourneyDayProgress,
  dayIndex: number,
  currentDayIndex: number | null,
): JourneyDayStatus {
  if (progress.complete) return 'complete';
  if (currentDayIndex !== null && dayIndex > currentDayIndex) return 'upcoming';
  if (progress.completedCount > 0) return 'partial';
  // The day still has hours left in it, so nothing has been missed yet.
  if (dayIndex === currentDayIndex) return 'in_progress';
  // Before the journey opens, `currentDayIndex` is null and every day is ahead
  // rather than behind.
  if (currentDayIndex === null) return 'upcoming';

  return 'missed';
}

export function selectDaySummaries(
  { journey, enrollment }: EnrolledJourney,
  completions: readonly JourneyCompletion[],
  now: Date = new Date(),
): JourneyDaySummary[] {
  const currentDayIndex = getCurrentDayIndex(journey, enrollment, now);

  return buildAllDayPlans(journey, enrollment).map((plan) => {
    const progress = selectDayProgress(plan, completions);

    return {
      ...progress,
      dayIndex: plan.dayIndex,
      date: plan.date,
      status: toDayStatus(progress, plan.dayIndex, currentDayIndex),
      isToday: plan.dayIndex === currentDayIndex,
    };
  });
}

// A day still in progress must not break a streak — the same rule the habit
// selectors use, and for the same reason: checking the tracker at breakfast
// should not report the streak as already lost.
function selectCurrentStreakFromSummaries(
  summaries: readonly JourneyDaySummary[],
  currentDayIndex: number | null,
): number {
  if (currentDayIndex === null) return 0;

  const completeByDayIndex = new Set(
    summaries.filter((summary) => summary.complete).map((summary) => summary.dayIndex),
  );

  let cursor = currentDayIndex;

  if (!completeByDayIndex.has(cursor)) {
    cursor -= 1;
  }

  let streak = 0;

  while (cursor >= 1 && completeByDayIndex.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }

  return streak;
}

function selectLongestStreakFromSummaries(summaries: readonly JourneyDaySummary[]): number {
  let longestStreak = 0;
  let currentRun = 0;

  for (const summary of summaries) {
    if (summary.complete) {
      currentRun += 1;
      longestStreak = Math.max(longestStreak, currentRun);
      continue;
    }

    currentRun = 0;
  }

  return longestStreak;
}

function selectCategoryCounts(
  plans: readonly JourneyDayPlan[],
  completions: readonly JourneyCompletion[],
): JourneyCategoryCount[] {
  const completedIds = selectCompletedActivityIds(completions);

  return JOURNEY_ACTIVITY_CATEGORY_VALUES.flatMap((category) => {
    const activities = plans.flatMap((plan) =>
      plan.activities.filter((activity) => activity.category === category),
    );

    // A journey that schedules nothing in a category should not show an empty
    // row for it — a reading-only journey has no physical card to report.
    if (activities.length === 0) return [];

    return [
      {
        category,
        completedCount: activities.filter((activity) => completedIds.has(activity.id)).length,
        activityCount: activities.length,
      },
    ];
  });
}

export function selectJourneyStats(
  enrolled: EnrolledJourney,
  completions: readonly JourneyCompletion[],
  now: Date = new Date(),
): JourneyStats {
  const { journey, enrollment } = enrolled;
  const plans = buildAllDayPlans(journey, enrollment);
  const currentDayIndex = getCurrentDayIndex(journey, enrollment, now);
  const summaries = selectDaySummaries(enrolled, completions, now);
  const categoryCounts = selectCategoryCounts(plans, completions);
  const elapsedDayCount = currentDayIndex ?? 0;

  return {
    currentDayIndex,
    elapsedDayCount,
    remainingDayCount: Math.max(0, journey.totalDays - elapsedDayCount),
    totalDays: journey.totalDays,
    currentStreak: selectCurrentStreakFromSummaries(summaries, currentDayIndex),
    longestStreak: selectLongestStreakFromSummaries(summaries),
    completedDayCount: summaries.filter((summary) => summary.complete).length,
    completedActivityCount: categoryCounts.reduce(
      (total, entry) => total + entry.completedCount,
      0,
    ),
    totalActivityCount: categoryCounts.reduce((total, entry) => total + entry.activityCount, 0),
    categoryCounts,
  };
}

function isReadingActivity(activity: JourneyActivity): boolean {
  return READING_CATEGORIES.some((category) => category === activity.category);
}

export function selectBookProgressList(
  { journey, enrollment }: EnrolledJourney,
  completions: readonly JourneyCompletion[],
  now: Date = new Date(),
): JourneyBookProgress[] {
  const completedIds = selectCompletedActivityIds(completions);
  const currentDayIndex = getCurrentDayIndex(journey, enrollment, now);
  const sessionsCompletedByBook = new Map<string, number>();
  const sessionsScheduledByBook = new Map<string, number>();
  const nextScheduledDayByBook = new Map<string, number>();

  for (const plan of buildAllDayPlans(journey, enrollment)) {
    for (const activity of plan.activities) {
      if (!isReadingActivity(activity) || activity.bookId === undefined) continue;

      sessionsScheduledByBook.set(
        activity.bookId,
        (sessionsScheduledByBook.get(activity.bookId) ?? 0) + 1,
      );

      if (completedIds.has(activity.id)) {
        sessionsCompletedByBook.set(
          activity.bookId,
          (sessionsCompletedByBook.get(activity.bookId) ?? 0) + 1,
        );
        continue;
      }

      // The first still-open session from today onwards, which is the one the
      // books page can usefully point at. Before the journey opens every day is
      // still ahead, so day 1 qualifies.
      const isUpcoming = currentDayIndex === null || plan.dayIndex >= currentDayIndex;

      if (isUpcoming && !nextScheduledDayByBook.has(activity.bookId)) {
        nextScheduledDayByBook.set(activity.bookId, plan.dayIndex);
      }
    }
  }

  return journey.books.map((book) => {
    const sessionsCompleted = sessionsCompletedByBook.get(book.id) ?? 0;
    // A book can be scheduled more often than it has pages for; the cap keeps
    // the progress bar honest rather than letting it run past 100%.
    const pagesRead = Math.min(book.pageCount, sessionsCompleted * journey.readingPagesPerSession);

    return {
      book,
      sessionsCompleted,
      sessionsScheduled: sessionsScheduledByBook.get(book.id) ?? 0,
      pagesRead,
      progress: Math.round((pagesRead / book.pageCount) * 100),
      nextScheduledDayIndex: nextScheduledDayByBook.get(book.id) ?? null,
    };
  });
}

export function selectBookProgressForTrack(
  bookProgressList: readonly JourneyBookProgress[],
  track: JourneyBookTrack,
): JourneyBookProgress[] {
  return bookProgressList.filter((entry) => entry.book.track === track);
}

export function selectActivitiesByCategory(plan: JourneyDayPlan): JourneyActivityGroup[] {
  return JOURNEY_ACTIVITY_CATEGORY_VALUES.flatMap((category) => {
    const activities = plan.activities.filter((activity) => activity.category === category);

    return activities.length > 0 ? [{ category, activities }] : [];
  });
}
