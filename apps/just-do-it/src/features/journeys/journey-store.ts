import { create } from 'zustand';

import {
  getInitialJourneyCompletions,
  getInitialJourneyEnrollments,
  getInitialJourneys,
  journeyCompletionSchema,
  journeyEnrollmentSchema,
  journeySchema,
  toJourneyDateKey,
} from './journey-data';
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
};

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
  completionId: string,
  enrollmentId: string,
  dayIndex: number,
  activityId: string,
  completedAt: Date,
): JourneyCompletion {
  return journeyCompletionSchema.parse({
    id: completionId,
    enrollmentId,
    dayIndex,
    activityId,
    completedAt: completedAt.toISOString(),
  });
}

export const useJourneyStore = create<JourneyStoreState>()((set) => ({
  journeys: getInitialJourneys(),
  enrollments: getInitialJourneyEnrollments(),
  completions: getInitialJourneyCompletions(),
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
          buildCompletionRecord(crypto.randomUUID(), enrollmentId, dayIndex, activityId, now),
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
}));

export { toJourneyDateKey };
