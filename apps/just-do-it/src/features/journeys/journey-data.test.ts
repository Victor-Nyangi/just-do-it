import { describe, expect, it } from 'vitest';

import {
  journeyCollectionSchema,
  journeyCompletionCollectionSchema,
  journeySchema,
  getInitialJourneyCompletions,
  getInitialJourneyEnrollments,
  getInitialJourneys,
} from './journey-data';

// A deliberately minimal but valid journey, so each test below can break one
// rule at a time rather than restating a whole fixture.
function buildJourneyInput(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-journey',
    title: 'Test journey',
    description: 'For tests',
    totalDays: 10,
    readingPagesPerSession: 10,
    reflectionLineCount: 3,
    physicalActivities: [{ id: 'walk', label: 'Walk', detail: 'Outdoors' }],
    physicalRotation: [['walk']],
    books: [],
    ...overrides,
  };
}

describe('the journey fixtures', () => {
  it('parses both seeded journeys', () => {
    expect(getInitialJourneys().map((journey) => journey.id)).toEqual([
      'hundred-day-discipline',
      'deep-work-reset',
    ]);
  });

  it('carries the discipline journey as a hundred days with both reading tracks', () => {
    const [discipline] = getInitialJourneys();

    expect(discipline.totalDays).toBe(100);
    expect(discipline.books.filter((book) => book.track === 'technical')).toHaveLength(6);
    expect(discipline.books.filter((book) => book.track === 'growth')).toHaveLength(13);
  });

  // The second journey exists to keep the model honest: a different length, no
  // physical work at all, and only one reading track.
  it('carries a second journey of an entirely different shape', () => {
    const deepWork = getInitialJourneys()[1];

    expect(deepWork.totalDays).toBe(30);
    expect(deepWork.physicalRotation).toEqual([]);
    expect(deepWork.books.every((book) => book.track === 'technical')).toBe(true);
  });

  // The dates live on the enrollment, not the journey — that split is the whole
  // point of the model, so it is worth pinning rather than assuming.
  it('keeps the start date on the enrollment rather than the journey', () => {
    const [enrollment] = getInitialJourneyEnrollments();

    expect(enrollment).toMatchObject({
      journeyId: 'hundred-day-discipline',
      startDate: '2026-09-11',
    });
    expect(getInitialJourneys()[0]).not.toHaveProperty('startDate');
  });

  // Stored in canonical export order, which is what stops the first commit of
  // an unchanged day from diffing the whole file. See journey-export.test.ts.
  it('scopes the seeded completions to an enrollment', () => {
    expect(getInitialJourneyCompletions()).toEqual([
      expect.objectContaining({
        enrollmentId: 'enrollment-discipline',
        activityId: 'day-1-technical-reading',
      }),
      expect.objectContaining({
        enrollmentId: 'enrollment-discipline',
        activityId: 'day-1-walk-1km',
      }),
    ]);
  });

  // getInitial* clones rather than handing out the parsed fixture, so a store
  // mutation cannot reach back and edit the module-level copy every later reset
  // is seeded from.
  it('hands out a fresh copy of each journey', () => {
    const [first] = getInitialJourneys();
    const [second] = getInitialJourneys();

    expect(first).not.toBe(second);
    expect(first.physicalRotation[0]).not.toBe(second.physicalRotation[0]);
    expect(first.books[0]).not.toBe(second.books[0]);
  });
});

describe('journeySchema', () => {
  it('accepts a minimal journey', () => {
    expect(journeySchema.safeParse(buildJourneyInput()).success).toBe(true);
  });

  it('accepts a journey with no physical work at all', () => {
    const result = journeySchema.safeParse(
      buildJourneyInput({ physicalActivities: [], physicalRotation: [] }),
    );

    expect(result.success).toBe(true);
  });

  it('accepts a journey with no reflection, as long as it schedules something else', () => {
    expect(journeySchema.safeParse(buildJourneyInput({ reflectionLineCount: 0 })).success).toBe(
      true,
    );
  });

  // Without this guard a journey could define nothing, and every one of its days
  // would be vacuously complete.
  it('refuses a journey that schedules nothing at all', () => {
    const result = journeySchema.safeParse(
      buildJourneyInput({
        reflectionLineCount: 0,
        physicalActivities: [],
        physicalRotation: [],
        books: [],
      }),
    );

    expect(result.success).toBe(false);
  });

  it('refuses a rotation that names an activity the journey does not define', () => {
    const result = journeySchema.safeParse(
      buildJourneyInput({ physicalRotation: [['walk'], ['swim']] }),
    );

    expect(result.success).toBe(false);
  });

  it('refuses duplicate book ids within a journey', () => {
    const book = { id: 'a', title: 'A', author: 'Author', track: 'technical', pageCount: 100 };
    const result = journeySchema.safeParse(buildJourneyInput({ books: [book, { ...book }] }));

    expect(result.success).toBe(false);
  });
});

describe('journeyCollectionSchema', () => {
  it('refuses two journeys sharing an id', () => {
    const result = journeyCollectionSchema.safeParse([buildJourneyInput(), buildJourneyInput()]);

    expect(result.success).toBe(false);
  });
});

describe('journeyCompletionCollectionSchema', () => {
  it('refuses two completions for the same activity in one enrollment', () => {
    const completion = {
      enrollmentId: 'e1',
      dayIndex: 1,
      activityId: 'day-1-reflection',
      completedAt: '2026-09-11T07:00:00.000Z',
    };
    const result = journeyCompletionCollectionSchema.safeParse([
      { ...completion, id: 'one' },
      { ...completion, id: 'two' },
    ]);

    expect(result.success).toBe(false);
  });

  // An activity id is only unique within its enrollment: two people running the
  // same journey both have a `day-1-reflection`, and so does one person running
  // it twice.
  it('allows the same activity id under two different enrollments', () => {
    const completion = {
      dayIndex: 1,
      activityId: 'day-1-reflection',
      completedAt: '2026-09-11T07:00:00.000Z',
    };
    const result = journeyCompletionCollectionSchema.safeParse([
      { ...completion, id: 'one', enrollmentId: 'e1' },
      { ...completion, id: 'two', enrollmentId: 'e2' },
    ]);

    expect(result.success).toBe(true);
  });

  it('refuses a completedAt that is not a real instant', () => {
    const result = journeyCompletionCollectionSchema.safeParse([
      { id: 'one', enrollmentId: 'e1', dayIndex: 1, activityId: 'x', completedAt: 'yesterday' },
    ]);

    expect(result.success).toBe(false);
  });
});
