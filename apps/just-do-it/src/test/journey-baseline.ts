// Deep imports rather than the feature barrel, deliberately: the barrel pulls
// in `JourneyExportCard` and so React, and four of the suites seeded from here
// run under node precisely to stay clear of that. See the setup notes in
// CLAUDE.md for what eager React costs the pure-logic suites.
import {
  getInitialJourneyEnrollments,
  getInitialJourneys,
} from '../features/journeys/journey-data';
import { buildDayPlan } from '../features/journeys/journey-plan';
import { useJourneyStore } from '../features/journeys/journey-store';
import type { JourneyCompletion } from '../features/journeys/types';

// `src/data/journey-completions.json` is a *record*, not a fixture. It changes
// every day the hundred-day journey is lived — that is the entire point of the
// publish loop — so seeding the store from it coupled the whole suite to one
// day's progress. Committing a real day then turned CI red, which is exactly
// backwards: the record is the thing the app exists to change.
//
// Tests therefore seed from this fixed baseline. Journeys and enrollments still
// come from the repo, because those are definitions.
const SEEDED_ENROLLMENT_ID = 'enrollment-discipline';

// Which activities day one actually asks for is *generated* from the journey
// definition, so naming them as literals here made every test that ticks one
// break the moment the movements changed. They are read off the plan instead:
// the store refuses a completion whose activity is not in the day's plan, so a
// stale literal fails as a silent no-op rather than an error anyone can read.
export function activityIdsForDay(dayIndex: number): string[] {
  const [journey] = getInitialJourneys();
  const [enrollment] = getInitialJourneyEnrollments();
  const plan = buildDayPlan(journey, enrollment, dayIndex);

  if (!plan) throw new Error(`The seeded journey has no day ${dayIndex}`);

  return plan.activities.map((activity) => activity.id);
}

export function activityIdForDay(dayIndex: number, category: 'physical' | 'reflection'): string {
  const [journey] = getInitialJourneys();
  const [enrollment] = getInitialJourneyEnrollments();
  const plan = buildDayPlan(journey, enrollment, dayIndex);
  const activity = plan?.activities.find((entry) => entry.category === category);

  if (!activity) throw new Error(`Day ${dayIndex} schedules no ${category} activity`);

  return activity.id;
}

function buildExampleCompletion(activityId: string, completedAt: string): JourneyCompletion {
  return {
    id: `${SEEDED_ENROLLMENT_ID}:1:${activityId}`,
    enrollmentId: SEEDED_ENROLLMENT_ID,
    dayIndex: 1,
    activityId,
    completedAt,
  };
}

// Two of day one's activities, ticked. Sorted by activity id so the baseline is
// already in the canonical export order `journey-export.ts` emits.
export const EXAMPLE_JOURNEY_COMPLETIONS: readonly JourneyCompletion[] = [
  buildExampleCompletion(activityIdForDay(1, 'physical'), '2026-09-12T07:20:00.000Z'),
  buildExampleCompletion('day-1-technical-reading', '2026-09-12T08:05:00.000Z'),
].toSorted((left, right) => (left.activityId < right.activityId ? -1 : 1));

export function buildJourneyBaselineState() {
  return {
    journeys: getInitialJourneys(),
    enrollments: getInitialJourneyEnrollments(),
    completions: EXAMPLE_JOURNEY_COMPLETIONS.map((completion) => ({ ...completion })),
  };
}

export function seedJourneyStore() {
  useJourneyStore.setState(buildJourneyBaselineState());
}
