import { describe, expect, it } from 'vitest';

import {
  challengeBookCollectionSchema,
  challengeCompletionCollectionSchema,
  challengeSchema,
  getInitialChallenge,
  getInitialChallengeBooks,
  getInitialChallengeCompletions,
} from './challenge-data';

// A deliberately minimal but valid challenge, so each test below can break one
// rule at a time rather than restating the whole fixture.
function buildChallengeInput(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-challenge',
    title: 'Test challenge',
    startDate: '2026-09-11',
    endDate: '2026-09-20',
    totalDays: 10,
    readingPagesPerSession: 10,
    reflectionLineCount: 3,
    physicalActivities: [{ id: 'walk', label: 'Walk', detail: 'Outdoors' }],
    physicalRotation: [['walk']],
    ...overrides,
  };
}

describe('the challenge fixtures', () => {
  it('parses the challenge into a hundred-day window', () => {
    const challenge = getInitialChallenge();

    expect(challenge.totalDays).toBe(100);
    expect(challenge.startDate).toBe('2026-09-11');
    expect(challenge.endDate).toBe('2026-12-19');
  });

  it('carries both reading tracks', () => {
    const books = getInitialChallengeBooks();

    expect(books.filter((book) => book.track === 'technical')).toHaveLength(6);
    expect(books.filter((book) => book.track === 'growth')).toHaveLength(13);
  });

  it('parses the seeded completions', () => {
    expect(getInitialChallengeCompletions().map((completion) => completion.activityId)).toEqual([
      'day-1-walk-1km',
      'day-1-technical-reading',
    ]);
  });

  // getInitial* clones rather than handing out the parsed fixture, so a store
  // mutation cannot reach back and edit the module-level copy every later
  // reset is seeded from.
  it('hands out a fresh copy of the challenge each time', () => {
    const first = getInitialChallenge();
    const second = getInitialChallenge();

    expect(first).not.toBe(second);
    expect(first.physicalActivities[0]).not.toBe(second.physicalActivities[0]);
    expect(first.physicalRotation[0]).not.toBe(second.physicalRotation[0]);
  });
});

describe('challengeSchema', () => {
  it('accepts a window whose end date matches the day count', () => {
    expect(challengeSchema.safeParse(buildChallengeInput()).success).toBe(true);
  });

  // The end date is redundant with startDate + totalDays, which is exactly why
  // it is worth checking: it catches a fixture edited on one side only.
  it('refuses a window whose end date disagrees with the day count', () => {
    const result = challengeSchema.safeParse(buildChallengeInput({ endDate: '2026-09-25' }));

    expect(result.success).toBe(false);
  });

  it('refuses a rotation that names an activity the challenge does not define', () => {
    const result = challengeSchema.safeParse(
      buildChallengeInput({ physicalRotation: [['walk'], ['swim']] }),
    );

    expect(result.success).toBe(false);
  });
});

describe('challengeBookCollectionSchema', () => {
  const technicalBook = {
    id: 'a',
    title: 'A',
    author: 'Author',
    track: 'technical',
    pageCount: 100,
  };
  const growthBook = { id: 'b', title: 'B', author: 'Author', track: 'growth', pageCount: 100 };

  it('accepts a list covering both tracks', () => {
    expect(challengeBookCollectionSchema.safeParse([technicalBook, growthBook]).success).toBe(true);
  });

  // Every day plan schedules one book from each track, so a missing track would
  // silently drop an activity from all hundred days.
  it('refuses a list with no growth books', () => {
    expect(challengeBookCollectionSchema.safeParse([technicalBook]).success).toBe(false);
  });

  it('refuses duplicate book ids', () => {
    const result = challengeBookCollectionSchema.safeParse([
      technicalBook,
      growthBook,
      { ...growthBook, title: 'Different title' },
    ]);

    expect(result.success).toBe(false);
  });
});

describe('challengeCompletionCollectionSchema', () => {
  it('refuses two completions for the same activity', () => {
    const result = challengeCompletionCollectionSchema.safeParse([
      {
        id: 'one',
        dayIndex: 1,
        activityId: 'day-1-reflection',
        completedAt: '2026-09-11T07:00:00.000Z',
      },
      {
        id: 'two',
        dayIndex: 1,
        activityId: 'day-1-reflection',
        completedAt: '2026-09-11T08:00:00.000Z',
      },
    ]);

    expect(result.success).toBe(false);
  });

  it('refuses a completedAt that is not a real instant', () => {
    const result = challengeCompletionCollectionSchema.safeParse([
      { id: 'one', dayIndex: 1, activityId: 'day-1-reflection', completedAt: 'yesterday' },
    ]);

    expect(result.success).toBe(false);
  });
});
