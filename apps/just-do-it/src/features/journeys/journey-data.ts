import { addDays, format, parseISO } from 'date-fns';
import { z } from 'zod';

import journeyCompletionsFixture from '../../data/journey-completions.json';
import journeyEnrollmentsFixture from '../../data/journey-enrollments.json';
import journeysFixture from '../../data/journeys.json';
import {
  JOURNEY_BOOK_TRACK_VALUES,
  JOURNEY_PHYSICAL_FOCUS_VALUES,
  JOURNEY_PHYSICAL_TRACK_VALUES,
  type Journey,
  type JourneyCompletion,
  type JourneyEnrollment,
} from './types';

const journeyDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a calendar date in YYYY-MM-DD form');

// Deliberately looser than the date schema above: a completion timestamp is a
// full instant rather than a calendar day, and `Date.parse` accepts every ISO
// form a server might send back.
const journeyTimestampSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Expected an ISO timestamp');

const journeyPhysicalLevelSchema = z.object({
  label: z.string().trim().min(1),
  detail: z.string().trim().min(1),
});

const journeyPhysicalActivitySchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  track: z.enum(JOURNEY_PHYSICAL_TRACK_VALUES),
  focus: z.enum(JOURNEY_PHYSICAL_FOCUS_VALUES),
  // At least one: a movement with no levels would schedule a day that asks for
  // nothing, which is the empty-day problem the refinements below exist to stop.
  levels: z.array(journeyPhysicalLevelSchema).min(1),
});

export const journeyBookSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  author: z.string().trim().min(1),
  track: z.enum(JOURNEY_BOOK_TRACK_VALUES),
  pageCount: z.number().int().min(1),
});

export const journeySchema = z
  .object({
    id: z.string().min(1),
    title: z.string().trim().min(1),
    description: z.string().trim(),
    totalDays: z.number().int().min(1).max(1000),
    readingPagesPerSession: z.number().int().min(1),
    // Zero is legal and means the journey asks for no reflection.
    reflectionLineCount: z.number().int().min(0),
    // Empty is legal throughout: a journey with no physical work, or no books
    // on a track, simply schedules none. Only a journey that would produce an
    // entirely empty day is refused, below.
    physicalActivities: z.array(journeyPhysicalActivitySchema),
    books: z.array(journeyBookSchema),
  })
  .refine(
    (journey) =>
      new Set(journey.physicalActivities.map((activity) => activity.id)).size ===
      journey.physicalActivities.length,
    {
      message: 'Duplicate physical activity id',
      path: ['physicalActivities'],
    },
  )
  // Without this a journey could define nothing at all, and every one of its
  // days would be vacuously complete. Any one of the three sources is enough.
  .refine(
    (journey) =>
      journey.reflectionLineCount > 0 ||
      journey.books.length > 0 ||
      journey.physicalActivities.length > 0,
    {
      message: 'A journey must schedule something: physical work, reading, or a reflection',
      path: ['physicalActivities'],
    },
  )
  .refine(
    (journey) => new Set(journey.books.map((book) => book.id)).size === journey.books.length,
    { message: 'Duplicate book id', path: ['books'] },
  );

export const journeyCollectionSchema = z.array(journeySchema).superRefine((journeys, context) => {
  const seenJourneyIds = new Set<string>();

  journeys.forEach((journey, index) => {
    if (seenJourneyIds.has(journey.id)) {
      context.addIssue({
        code: 'custom',
        message: `Duplicate journey id ${journey.id}`,
        path: [index],
      });
      return;
    }

    seenJourneyIds.add(journey.id);
  });
});

export const journeyEnrollmentSchema = z.object({
  id: z.string().min(1),
  journeyId: z.string().min(1),
  startDate: journeyDateSchema,
  createdAt: journeyTimestampSchema,
});

export const journeyEnrollmentCollectionSchema = z.array(journeyEnrollmentSchema);

export const journeyCompletionSchema = z.object({
  id: z.string().min(1),
  enrollmentId: z.string().min(1),
  dayIndex: z.number().int().min(1),
  activityId: z.string().min(1),
  completedAt: journeyTimestampSchema,
});

export const journeyCompletionCollectionSchema = z
  .array(journeyCompletionSchema)
  .superRefine((completions, context) => {
    // An activity id is only unique within its enrollment — two people running
    // the same journey both have a `day-1-reflection`.
    const seenKeys = new Set<string>();

    completions.forEach((completion, index) => {
      const completionKey = `${completion.enrollmentId}|${completion.activityId}`;

      if (seenKeys.has(completionKey)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate completion for ${completionKey}`,
          path: [index],
        });
        return;
      }

      seenKeys.add(completionKey);
    });
  });

const validatedJourneyFixture = journeyCollectionSchema.parse(journeysFixture);
const validatedJourneyEnrollmentFixture =
  journeyEnrollmentCollectionSchema.parse(journeyEnrollmentsFixture);
const validatedJourneyCompletionFixture =
  journeyCompletionCollectionSchema.parse(journeyCompletionsFixture);

// Referential integrity across the three fixtures, which no single schema can
// see. A dangling enrollment would render as a broken route rather than throw.
for (const enrollment of validatedJourneyEnrollmentFixture) {
  const journey = validatedJourneyFixture.find((entry) => entry.id === enrollment.journeyId);

  if (!journey) {
    throw new Error(
      `Enrollment ${enrollment.id} points at unknown journey ${enrollment.journeyId}`,
    );
  }
}

for (const completion of validatedJourneyCompletionFixture) {
  const enrollment = validatedJourneyEnrollmentFixture.find(
    (entry) => entry.id === completion.enrollmentId,
  );

  if (!enrollment) {
    throw new Error(
      `Completion ${completion.id} points at unknown enrollment ${completion.enrollmentId}`,
    );
  }

  const journey = validatedJourneyFixture.find((entry) => entry.id === enrollment.journeyId);

  if (journey && completion.dayIndex > journey.totalDays) {
    throw new Error(
      `Completion ${completion.id} is on day ${completion.dayIndex}, past the ${journey.totalDays}-day journey`,
    );
  }
}

export function cloneJourney(journey: Journey): Journey {
  return {
    ...journey,
    physicalActivities: journey.physicalActivities.map((activity) => ({
      ...activity,
      levels: activity.levels.map((level) => ({ ...level })),
    })),
    books: journey.books.map((book) => ({ ...book })),
  };
}

export function cloneJourneyEnrollment(enrollment: JourneyEnrollment): JourneyEnrollment {
  return { ...enrollment };
}

export function cloneJourneyCompletion(completion: JourneyCompletion): JourneyCompletion {
  return { ...completion };
}

export function getInitialJourneys(): Journey[] {
  return validatedJourneyFixture.map(cloneJourney);
}

export function getInitialJourneyEnrollments(): JourneyEnrollment[] {
  return validatedJourneyEnrollmentFixture.map(cloneJourneyEnrollment);
}

export function getInitialJourneyCompletions(): JourneyCompletion[] {
  return validatedJourneyCompletionFixture.map(cloneJourneyCompletion);
}

export function toJourneyDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function addJourneyDays(dateKey: string, dayCount: number): string {
  return toJourneyDateKey(addDays(parseISO(dateKey), dayCount));
}

export {
  validatedJourneyCompletionFixture,
  validatedJourneyEnrollmentFixture,
  validatedJourneyFixture,
};
