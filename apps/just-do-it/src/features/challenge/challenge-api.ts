import { useChallengeStore } from './challenge-store';
import {
  selectChallengeStats,
  selectCompletedActivityIdsForDay,
  selectDayProgress,
} from './challenge-selectors';
import { buildDayPlan } from './challenge-plan';
import type { ChallengeDayPlan, ChallengeStats } from './types';

// The three operations the feature was specified as HTTP endpoints:
//
//   GET  /api/challenge/day/[dayIndex]           -> getChallengeDay
//   POST /api/challenge/day/[dayIndex]/complete  -> completeChallengeActivity
//   GET  /api/challenge/stats                    -> getChallengeStats
//
// This app has no server — see the repository's CLAUDE.md — so they run
// in-process against the session store rather than over the network. What is
// preserved is the contract: the same addressing by day index, the same
// response shapes, and the same toggle semantics on complete. Moving this
// behind a real API means reimplementing these three function bodies as fetch
// calls, and touching nothing that consumes them.
//
// The planned `challenge_completions` row is (user_id, day_index, activity_id,
// completed_at). The user id is missing here on purpose: it belongs to the
// authenticated session, which the server reads for itself. A client that sent
// its own user id would be stating who it is rather than proving it.

export type ChallengeDayResponse = {
  dayIndex: number;
  date: string;
  plan: ChallengeDayPlan;
  completedActivityIds: string[];
  completedCount: number;
  activityCount: number;
  complete: boolean;
};

function toChallengeDayResponse(plan: ChallengeDayPlan): ChallengeDayResponse {
  const { completions } = useChallengeStore.getState();
  const progress = selectDayProgress(plan, completions);
  const completedIds = selectCompletedActivityIdsForDay(completions, plan.dayIndex);

  return {
    dayIndex: plan.dayIndex,
    date: plan.date,
    plan,
    // Ordered by the plan rather than by when they were ticked, so the response
    // is stable for a given set of completions.
    completedActivityIds: plan.activities
      .map((activity) => activity.id)
      .filter((activityId) => completedIds.has(activityId)),
    completedCount: progress.completedCount,
    activityCount: progress.activityCount,
    complete: progress.complete,
  };
}

// Null stands in for a 404: day indexes run from 1 to the challenge length.
export function getChallengeDay(dayIndex: number): ChallengeDayResponse | null {
  const { challenge, books } = useChallengeStore.getState();
  const plan = buildDayPlan(challenge, books, dayIndex);

  return plan ? toChallengeDayResponse(plan) : null;
}

// Toggles rather than sets, as specified. Returns the day as it now stands, so
// a caller needs one round trip rather than two.
export function completeChallengeActivity(
  dayIndex: number,
  activityId: string,
): ChallengeDayResponse | null {
  const { challenge, books, toggleActivityCompletion } = useChallengeStore.getState();
  const plan = buildDayPlan(challenge, books, dayIndex);
  if (!plan) return null;

  toggleActivityCompletion(dayIndex, activityId);

  return toChallengeDayResponse(plan);
}

export function getChallengeStats(now: Date = new Date()): ChallengeStats {
  const { challenge, books, completions } = useChallengeStore.getState();

  return selectChallengeStats(challenge, books, completions, now);
}
