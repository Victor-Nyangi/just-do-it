import { useJourneyStore } from './journey-store';
import { buildDayPlan } from './journey-plan';
import {
  selectCompletedActivityIdsForDay,
  selectCompletionsForEnrollment,
  selectDayProgress,
  selectEnrolledJourney,
  selectJourneyStats,
} from './journey-selectors';
import type { EnrolledJourney, JourneyDayPlan, JourneyStats } from './types';

// The operations this feature was specified as HTTP endpoints, now scoped to an
// enrollment rather than to the single hard-coded challenge they started as:
//
//   GET  /api/enrollments/[id]/day/[dayIndex]           -> getJourneyDay
//   POST /api/enrollments/[id]/day/[dayIndex]/complete  -> completeJourneyActivity
//   GET  /api/enrollments/[id]/stats                    -> getJourneyStats
//
// This app has no backend — see the repository's CLAUDE.md — so they run
// in-process against the session store. What is preserved is the contract: the
// same addressing, the same response shapes, the same toggle semantics on
// complete, and null standing in for a 404. Moving this behind a real API means
// reimplementing these three function bodies as fetch calls, and touching
// nothing that consumes them.
//
// The planned `completions` row is (user_id, enrollment_id, day_index,
// activity_id, completed_at). The user id is missing here on purpose: it
// belongs to the authenticated session, which the server reads for itself. A
// client that sent its own user id would be stating who it is rather than
// proving it.

export type JourneyDayResponse = {
  enrollmentId: string;
  journeyId: string;
  dayIndex: number;
  date: string;
  plan: JourneyDayPlan;
  completedActivityIds: string[];
  completedCount: number;
  activityCount: number;
  complete: boolean;
};

function toJourneyDayResponse(enrolled: EnrolledJourney, plan: JourneyDayPlan): JourneyDayResponse {
  const completions = selectCompletionsForEnrollment(
    useJourneyStore.getState().completions,
    enrolled.enrollment.id,
  );
  const progress = selectDayProgress(plan, completions);
  const completedIds = selectCompletedActivityIdsForDay(completions, plan.dayIndex);

  return {
    enrollmentId: enrolled.enrollment.id,
    journeyId: enrolled.journey.id,
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

function resolveEnrollment(enrollmentId: string): EnrolledJourney | null {
  const { journeys, enrollments } = useJourneyStore.getState();

  return selectEnrolledJourney(journeys, enrollments, enrollmentId);
}

// Null stands in for a 404: an unknown enrollment, or a day index outside the
// journey's length.
export function getJourneyDay(enrollmentId: string, dayIndex: number): JourneyDayResponse | null {
  const enrolled = resolveEnrollment(enrollmentId);
  if (!enrolled) return null;

  const plan = buildDayPlan(enrolled.journey, enrolled.enrollment, dayIndex);

  return plan ? toJourneyDayResponse(enrolled, plan) : null;
}

// Toggles rather than sets, as specified. Returns the day as it now stands, so
// a caller needs one round trip rather than two.
export function completeJourneyActivity(
  enrollmentId: string,
  dayIndex: number,
  activityId: string,
): JourneyDayResponse | null {
  const enrolled = resolveEnrollment(enrollmentId);
  if (!enrolled) return null;

  const plan = buildDayPlan(enrolled.journey, enrolled.enrollment, dayIndex);
  if (!plan) return null;

  useJourneyStore.getState().toggleActivityCompletion(enrollmentId, dayIndex, activityId);

  return toJourneyDayResponse(enrolled, plan);
}

export function getJourneyStats(enrollmentId: string, now: Date = new Date()): JourneyStats | null {
  const enrolled = resolveEnrollment(enrollmentId);
  if (!enrolled) return null;

  const completions = selectCompletionsForEnrollment(
    useJourneyStore.getState().completions,
    enrollmentId,
  );

  return selectJourneyStats(enrolled, completions, now);
}
