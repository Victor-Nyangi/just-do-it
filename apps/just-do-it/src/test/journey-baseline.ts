// Deep imports rather than the feature barrel, deliberately: the barrel pulls
// in `JourneyExportCard` and so React, and four of the suites seeded from here
// run under node precisely to stay clear of that. See the setup notes in
// CLAUDE.md for what eager React costs the pure-logic suites.
import {
  getInitialJourneyEnrollments,
  getInitialJourneys,
} from '../features/journeys/journey-data';
import { useJourneyStore } from '../features/journeys/journey-store';
import type { JourneyCompletion } from '../features/journeys/types';

// `src/data/journey-completions.json` is a *record*, not a fixture. It changes
// every day the hundred-day journey is lived — that is the entire point of the
// publish loop — so seeding the store from it coupled the whole suite to one
// day's progress. Committing a real day then turned CI red, which is exactly
// backwards: the record is the thing the app exists to change.
//
// Tests therefore seed from this fixed baseline. Journeys and enrollments still
// come from the repo, because those are definitions and do not move.
export const EXAMPLE_JOURNEY_COMPLETIONS: readonly JourneyCompletion[] = [
  {
    id: 'enrollment-discipline:1:day-1-technical-reading',
    enrollmentId: 'enrollment-discipline',
    dayIndex: 1,
    activityId: 'day-1-technical-reading',
    completedAt: '2026-09-12T08:05:00.000Z',
  },
  {
    id: 'enrollment-discipline:1:day-1-walk-1km',
    enrollmentId: 'enrollment-discipline',
    dayIndex: 1,
    activityId: 'day-1-walk-1km',
    completedAt: '2026-09-12T07:20:00.000Z',
  },
];

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
