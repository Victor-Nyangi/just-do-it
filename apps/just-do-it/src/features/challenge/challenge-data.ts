import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { z } from 'zod';

import challengeBooksFixture from '../../data/challenge-books.json';
import challengeCompletionsFixture from '../../data/challenge-completions.json';
import challengeFixture from '../../data/challenge.json';
import {
  CHALLENGE_BOOK_TRACK_VALUES,
  type Challenge,
  type ChallengeBook,
  type ChallengeCompletion,
} from './types';

const challengeDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a calendar date in YYYY-MM-DD form');

// Deliberately looser than the date schema above: a completion timestamp is a
// full instant rather than a calendar day, and `Date.parse` accepts every ISO
// form a server might send back.
const challengeTimestampSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Expected an ISO timestamp');

const challengePhysicalActivitySchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1),
  detail: z.string().trim().min(1),
});

export const challengeSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().trim().min(1),
    startDate: challengeDateSchema,
    endDate: challengeDateSchema,
    totalDays: z.number().int().min(1),
    readingPagesPerSession: z.number().int().min(1),
    reflectionLineCount: z.number().int().min(1),
    physicalActivities: z.array(challengePhysicalActivitySchema).min(1),
    physicalRotation: z.array(z.array(z.string().min(1)).min(1)).min(1),
  })
  // The end date is derivable from the start date and the day count, so it is
  // redundant — which makes it a useful consistency check rather than dead
  // weight. A fixture whose window and day count disagree throws at boot.
  .refine(
    (challenge) =>
      differenceInCalendarDays(parseISO(challenge.endDate), parseISO(challenge.startDate)) + 1 ===
      challenge.totalDays,
    {
      message: 'endDate must be exactly totalDays after startDate, counting both ends',
      path: ['endDate'],
    },
  )
  .refine(
    (challenge) => {
      const knownActivityIds = new Set(challenge.physicalActivities.map((activity) => activity.id));

      return challenge.physicalRotation.every((day) =>
        day.every((activityId) => knownActivityIds.has(activityId)),
      );
    },
    {
      message: 'physicalRotation references a physical activity that does not exist',
      path: ['physicalRotation'],
    },
  );

export const challengeBookSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  author: z.string().trim().min(1),
  track: z.enum(CHALLENGE_BOOK_TRACK_VALUES),
  pageCount: z.number().int().min(1),
});

export const challengeBookCollectionSchema = z
  .array(challengeBookSchema)
  .min(1)
  .superRefine((books, context) => {
    const seenBookIds = new Set<string>();

    books.forEach((book, index) => {
      if (seenBookIds.has(book.id)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate book id ${book.id}`,
          path: [index],
        });
        return;
      }

      seenBookIds.add(book.id);
    });

    for (const track of CHALLENGE_BOOK_TRACK_VALUES) {
      if (!books.some((book) => book.track === track)) {
        context.addIssue({
          code: 'custom',
          message: `No books on the ${track} track — every day plan needs one`,
          path: [],
        });
      }
    }
  });

export const challengeCompletionSchema = z.object({
  id: z.string().min(1),
  dayIndex: z.number().int().min(1),
  activityId: z.string().min(1),
  completedAt: challengeTimestampSchema,
});

export const challengeCompletionCollectionSchema = z
  .array(challengeCompletionSchema)
  .superRefine((completions, context) => {
    const seenActivityIds = new Set<string>();

    completions.forEach((completion, index) => {
      if (seenActivityIds.has(completion.activityId)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate completion for ${completion.activityId}`,
          path: [index],
        });
        return;
      }

      seenActivityIds.add(completion.activityId);
    });
  });

const validatedChallengeFixture = challengeSchema.parse(challengeFixture);
const validatedChallengeBookFixture = challengeBookCollectionSchema.parse(challengeBooksFixture);
const validatedChallengeCompletionFixture = challengeCompletionCollectionSchema.parse(
  challengeCompletionsFixture,
);

// A completion carries a day index rather than a date, so nothing above can
// catch a row that falls outside the challenge window. This can.
const challengeWindowEnd = validatedChallengeFixture.totalDays;

for (const completion of validatedChallengeCompletionFixture) {
  if (completion.dayIndex > challengeWindowEnd) {
    throw new Error(
      `Completion ${completion.id} is on day ${completion.dayIndex}, past the ${challengeWindowEnd}-day challenge`,
    );
  }
}

export function cloneChallenge(challenge: Challenge): Challenge {
  return {
    ...challenge,
    physicalActivities: challenge.physicalActivities.map((activity) => ({ ...activity })),
    physicalRotation: challenge.physicalRotation.map((day) => [...day]),
  };
}

export function cloneChallengeBook(book: ChallengeBook): ChallengeBook {
  return { ...book };
}

export function cloneChallengeCompletion(completion: ChallengeCompletion): ChallengeCompletion {
  return { ...completion };
}

export function getInitialChallenge(): Challenge {
  return cloneChallenge(validatedChallengeFixture);
}

export function getInitialChallengeBooks(): ChallengeBook[] {
  return validatedChallengeBookFixture.map(cloneChallengeBook);
}

export function getInitialChallengeCompletions(): ChallengeCompletion[] {
  return validatedChallengeCompletionFixture.map(cloneChallengeCompletion);
}

// Exported for the fixture-window guard above and reused by the plan module,
// which needs the same date arithmetic without importing the store.
export function toChallengeDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function addChallengeDays(dateKey: string, dayCount: number): string {
  return toChallengeDateKey(addDays(parseISO(dateKey), dayCount));
}

export {
  validatedChallengeBookFixture,
  validatedChallengeCompletionFixture,
  validatedChallengeFixture,
};
