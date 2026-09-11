import { buildAllDayPlans, getCurrentDayIndex } from './challenge-plan';
import {
  CHALLENGE_ACTIVITY_CATEGORY_VALUES,
  type Challenge,
  type ChallengeActivity,
  type ChallengeActivityGroup,
  type ChallengeBook,
  type ChallengeBookProgress,
  type ChallengeBookTrack,
  type ChallengeCategoryCount,
  type ChallengeCompletion,
  type ChallengeDayPlan,
  type ChallengeDayProgress,
  type ChallengeDayStatus,
  type ChallengeDaySummary,
  type ChallengeStats,
} from './types';

const READING_CATEGORIES = ['technical_reading', 'growth_reading'] as const;

export function selectCompletedActivityIds(
  completions: readonly ChallengeCompletion[],
): Set<string> {
  return new Set(completions.map((completion) => completion.activityId));
}

export function selectCompletedActivityIdsForDay(
  completions: readonly ChallengeCompletion[],
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

export function isChallengeActivityCompleted(
  completions: readonly ChallengeCompletion[],
  activityId: string,
): boolean {
  return completions.some((completion) => completion.activityId === activityId);
}

export function selectDayProgress(
  plan: ChallengeDayPlan,
  completions: readonly ChallengeCompletion[],
): ChallengeDayProgress {
  const completedIds = selectCompletedActivityIdsForDay(completions, plan.dayIndex);
  const completedCount = plan.activities.filter((activity) => completedIds.has(activity.id)).length;

  return {
    completedCount,
    activityCount: plan.activities.length,
    // An empty day would otherwise read as complete. No plan is empty today,
    // but a rotation edit could make one, and "0 of 0 done" is not a win.
    complete: plan.activities.length > 0 && completedCount === plan.activities.length,
  };
}

function toDayStatus(
  progress: ChallengeDayProgress,
  dayIndex: number,
  currentDayIndex: number | null,
): ChallengeDayStatus {
  if (progress.complete) return 'complete';
  if (currentDayIndex !== null && dayIndex > currentDayIndex) return 'upcoming';
  if (progress.completedCount > 0) return 'partial';
  // The day still has hours left in it, so nothing has been missed yet.
  if (dayIndex === currentDayIndex) return 'in_progress';
  // Before the challenge opens, `currentDayIndex` is null and every day is
  // ahead rather than behind.
  if (currentDayIndex === null) return 'upcoming';

  return 'missed';
}

export function selectDaySummaries(
  challenge: Challenge,
  books: readonly ChallengeBook[],
  completions: readonly ChallengeCompletion[],
  now: Date = new Date(),
): ChallengeDaySummary[] {
  const currentDayIndex = getCurrentDayIndex(challenge, now);

  return buildAllDayPlans(challenge, books).map((plan) => {
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
  summaries: readonly ChallengeDaySummary[],
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

function selectLongestStreakFromSummaries(summaries: readonly ChallengeDaySummary[]): number {
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
  plans: readonly ChallengeDayPlan[],
  completions: readonly ChallengeCompletion[],
): ChallengeCategoryCount[] {
  const completedIds = selectCompletedActivityIds(completions);

  return CHALLENGE_ACTIVITY_CATEGORY_VALUES.map((category) => {
    const activities = plans.flatMap((plan) =>
      plan.activities.filter((activity) => activity.category === category),
    );

    return {
      category,
      completedCount: activities.filter((activity) => completedIds.has(activity.id)).length,
      activityCount: activities.length,
    };
  });
}

export function selectChallengeStats(
  challenge: Challenge,
  books: readonly ChallengeBook[],
  completions: readonly ChallengeCompletion[],
  now: Date = new Date(),
): ChallengeStats {
  const plans = buildAllDayPlans(challenge, books);
  const currentDayIndex = getCurrentDayIndex(challenge, now);
  const summaries = selectDaySummaries(challenge, books, completions, now);
  const categoryCounts = selectCategoryCounts(plans, completions);
  const elapsedDayCount = currentDayIndex ?? 0;

  return {
    currentDayIndex,
    elapsedDayCount,
    remainingDayCount: Math.max(0, challenge.totalDays - elapsedDayCount),
    totalDays: challenge.totalDays,
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

function isReadingActivity(activity: ChallengeActivity): boolean {
  return READING_CATEGORIES.some((category) => category === activity.category);
}

export function selectBookProgressList(
  challenge: Challenge,
  books: readonly ChallengeBook[],
  completions: readonly ChallengeCompletion[],
  now: Date = new Date(),
): ChallengeBookProgress[] {
  const completedIds = selectCompletedActivityIds(completions);
  const currentDayIndex = getCurrentDayIndex(challenge, now);
  const sessionsCompletedByBook = new Map<string, number>();
  const sessionsScheduledByBook = new Map<string, number>();
  const nextScheduledDayByBook = new Map<string, number>();

  for (const plan of buildAllDayPlans(challenge, books)) {
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
      // books page can usefully point at. Before the challenge opens every day
      // is still ahead, so day 1 qualifies.
      const isUpcoming = currentDayIndex === null || plan.dayIndex >= currentDayIndex;

      if (isUpcoming && !nextScheduledDayByBook.has(activity.bookId)) {
        nextScheduledDayByBook.set(activity.bookId, plan.dayIndex);
      }
    }
  }

  return books.map((book) => {
    const sessionsCompleted = sessionsCompletedByBook.get(book.id) ?? 0;
    // A book can be scheduled more often than it has pages for; the cap keeps
    // the progress bar honest rather than letting it run past 100%.
    const pagesRead = Math.min(
      book.pageCount,
      sessionsCompleted * challenge.readingPagesPerSession,
    );

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
  bookProgressList: readonly ChallengeBookProgress[],
  track: ChallengeBookTrack,
): ChallengeBookProgress[] {
  return bookProgressList.filter((entry) => entry.book.track === track);
}

export function selectActivitiesByCategory(plan: ChallengeDayPlan): ChallengeActivityGroup[] {
  return CHALLENGE_ACTIVITY_CATEGORY_VALUES.flatMap((category) => {
    const activities = plan.activities.filter((activity) => activity.category === category);

    return activities.length > 0 ? [{ category, activities }] : [];
  });
}
