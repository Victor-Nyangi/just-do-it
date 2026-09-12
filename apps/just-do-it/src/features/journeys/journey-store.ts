import { create } from 'zustand';

import {
  journeyCompletionSchema,
  journeyEnrollmentSchema,
  journeySchema,
  toJourneyDateKey,
} from './journey-data';
import {
  buildInitialJourneyState,
  clearPersistedJourneyState,
  savePersistedJourneyState,
} from './journey-persistence';
import { buildDayPlan } from './journey-plan';
import { selectEnrolledJourney } from './journey-selectors';
import type { Journey, JourneyCompletion, JourneyEnrollment, JourneyInput } from './types';

type JourneyStoreState = {
  journeys: Journey[];
  enrollments: JourneyEnrollment[];
  completions: JourneyCompletion[];
  toggleActivityCompletion: (
    enrollmentId: string,
    dayIndex: number,
    activityId: string,
    now?: Date,
  ) => void;
  enrollInJourney: (journeyId: string, startDate: string, now?: Date) => string | null;
  leaveJourney: (enrollmentId: string) => void;
  createJourney: (input: JourneyInput) => string;
  resetToCommittedState: () => void;
};

// A completion's natural key is (enrollment, day, activity) — the same triple
// that is planned as its primary key in the database. Deriving the id from it
// rather than from `crypto.randomUUID()` is a deliberate exception to this
// repo's ID convention, and it buys two things: exporting the same state twice
// produces byte-identical JSON, and re-ticking a box that was already ticked
// cannot produce a second row under a different id.
export function toCompletionId(enrollmentId: string, dayIndex: number, activityId: string): string {
  return `${enrollmentId}:${dayIndex}:${activityId}`;
}

function buildJourneyRecord(journeyId: string, input: JourneyInput): Journey {
  return journeySchema.parse({
    id: journeyId,
    title: input.title,
    description: input.description,
    totalDays: input.totalDays,
    readingPagesPerSession: input.readingPagesPerSession ?? 10,
    reflectionLineCount: input.reflectionLineCount ?? 3,
    physicalActivities: input.physicalActivities ?? [],
    physicalRotation: input.physicalRotation ?? [],
    books: input.books ?? [],
  });
}

function buildEnrollmentRecord(
  enrollmentId: string,
  journeyId: string,
  startDate: string,
  createdAt: Date,
): JourneyEnrollment {
  return journeyEnrollmentSchema.parse({
    id: enrollmentId,
    journeyId,
    startDate,
    createdAt: createdAt.toISOString(),
  });
}

function buildCompletionRecord(
  enrollmentId: string,
  dayIndex: number,
  activityId: string,
  completedAt: Date,
): JourneyCompletion {
  return journeyCompletionSchema.parse({
    id: toCompletionId(enrollmentId, dayIndex, activityId),
    enrollmentId,
    dayIndex,
    activityId,
    completedAt: completedAt.toISOString(),
  });
}

const initialState = buildInitialJourneyState();

export const useJourneyStore = create<JourneyStoreState>()((set) => ({
  journeys: initialState.journeys,
  enrollments: initialState.enrollments,
  completions: initialState.completions,
  toggleActivityCompletion: (enrollmentId, dayIndex, activityId, now = new Date()) => {
    set((state) => {
      const enrolled = selectEnrolledJourney(state.journeys, state.enrollments, enrollmentId);
      if (!enrolled) return state;

      // The plan is generated rather than stored, so this is the only place
      // that can tell a real activity id from a stale or invented one. Without
      // it a completion could be written against an activity no day offers.
      const plan = buildDayPlan(enrolled.journey, enrolled.enrollment, dayIndex);
      if (!plan?.activities.some((activity) => activity.id === activityId)) return state;

      const existingCompletion = state.completions.find(
        (completion) =>
          completion.enrollmentId === enrollmentId && completion.activityId === activityId,
      );

      if (existingCompletion) {
        return {
          completions: state.completions.filter(
            (completion) => completion.id !== existingCompletion.id,
          ),
        };
      }

      return {
        completions: [
          ...state.completions,
          buildCompletionRecord(enrollmentId, dayIndex, activityId, now),
        ],
      };
    });
  },
  enrollInJourney: (journeyId, startDate, now = new Date()) => {
    const enrollmentId = crypto.randomUUID();
    let enrolled = false;

    set((state) => {
      if (!state.journeys.some((journey) => journey.id === journeyId)) return state;

      enrolled = true;

      return {
        enrollments: [
          ...state.enrollments,
          buildEnrollmentRecord(enrollmentId, journeyId, startDate, now),
        ],
      };
    });

    return enrolled ? enrollmentId : null;
  },
  leaveJourney: (enrollmentId) => {
    set((state) => ({
      enrollments: state.enrollments.filter((enrollment) => enrollment.id !== enrollmentId),
      // Completions belong to the enrollment, not the journey, so leaving takes
      // its history with it rather than stranding orphan rows.
      completions: state.completions.filter(
        (completion) => completion.enrollmentId !== enrollmentId,
      ),
    }));
  },
  createJourney: (input) => {
    const journeyId = crypto.randomUUID();

    set((state) => ({ journeys: [...state.journeys, buildJourneyRecord(journeyId, input)] }));

    return journeyId;
  },
  // Throws away everything this browser remembers and goes back to what is
  // committed in the repo. The escape hatch for local state that has drifted
  // from the record, and the way to see the deployed site as a visitor does.
  resetToCommittedState: () => {
    clearPersistedJourneyState();
    set(buildInitialJourneyState());
  },
}));

// Persist after every mutation rather than on a timer or on unload: the writes
// are small, and anything else risks losing the tick that was the whole point.
useJourneyStore.subscribe((state) => {
  savePersistedJourneyState({
    journeys: state.journeys,
    enrollments: state.enrollments,
    completions: state.completions,
  });
});

export { toJourneyDateKey };
