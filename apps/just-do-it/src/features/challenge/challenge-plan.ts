import { differenceInCalendarDays, parseISO } from 'date-fns';

import { addChallengeDays } from './challenge-data';
import type {
  Challenge,
  ChallengeActivity,
  ChallengeBook,
  ChallengeBookTrack,
  ChallengeDayPlan,
} from './types';

// The plan is generated, not stored: a day's activities are a pure function of
// its index, so the same day always yields the same plan on every device and
// every render, and 100 days of fixture rows never have to be written by hand.
//
// "Randomised but consistent" is the requirement, and a plain modulo would be
// consistent without being randomised — the books would cycle in fixture order
// forever. So each pass through a track's book list is shuffled by a seeded
// permutation instead. Within one cycle every book still appears exactly once,
// which is what keeps per-book progress even, but the order inside the cycle
// looks arbitrary and changes from one cycle to the next.

// mulberry32. Small, fast, and — the part that matters here — identical across
// engines, which `Math.random()` with a seed is not.
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let result = Math.imul(state ^ (state >>> 15), 1 | state);
    result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result;
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a, so that a track name and cycle number can seed the shuffle directly
// rather than needing a hand-maintained table of seeds.
function hashSeed(text: string): number {
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function buildSeededPermutation(length: number, seed: number): number[] {
  const order = Array.from({ length }, (_, index) => index);
  const nextRandom = createSeededRandom(seed);

  // Fisher-Yates, driven by the seeded generator rather than Math.random.
  for (let index = length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(nextRandom() * (index + 1));
    [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  }

  return order;
}

export function selectBooksForTrack(
  books: readonly ChallengeBook[],
  track: ChallengeBookTrack,
): ChallengeBook[] {
  return books.filter((book) => book.track === track);
}

// `dayOffset` is zero-based (day 1 of the challenge is offset 0), because every
// rotation below is modular arithmetic and a one-based index would put day 1 in
// the second slot.
function selectBookForDay(
  books: readonly ChallengeBook[],
  track: ChallengeBookTrack,
  dayOffset: number,
): ChallengeBook | null {
  const trackBooks = selectBooksForTrack(books, track);
  if (trackBooks.length === 0) return null;

  const cycleIndex = Math.floor(dayOffset / trackBooks.length);
  const positionInCycle = dayOffset % trackBooks.length;
  const order = buildSeededPermutation(trackBooks.length, hashSeed(`${track}:${cycleIndex}`));

  return trackBooks[order[positionInCycle]];
}

export function isValidDayIndex(challenge: Challenge, dayIndex: number): boolean {
  return Number.isInteger(dayIndex) && dayIndex >= 1 && dayIndex <= challenge.totalDays;
}

export function clampDayIndex(challenge: Challenge, dayIndex: number): number {
  if (!Number.isFinite(dayIndex)) return 1;

  return Math.min(challenge.totalDays, Math.max(1, Math.round(dayIndex)));
}

export function getDateKeyForDayIndex(challenge: Challenge, dayIndex: number): string | null {
  if (!isValidDayIndex(challenge, dayIndex)) return null;

  return addChallengeDays(challenge.startDate, dayIndex - 1);
}

export function getDayIndexForDate(challenge: Challenge, date: Date): number | null {
  const dayIndex = differenceInCalendarDays(date, parseISO(challenge.startDate)) + 1;

  return isValidDayIndex(challenge, dayIndex) ? dayIndex : null;
}

// Null before the challenge opens and after it closes, which the routes render
// as their own states rather than pretending some day is current.
export function getCurrentDayIndex(challenge: Challenge, now: Date = new Date()): number | null {
  return getDayIndexForDate(challenge, now);
}

function buildPhysicalActivities(
  challenge: Challenge,
  dayIndex: number,
  dayOffset: number,
): ChallengeActivity[] {
  const rotationIndex = dayOffset % challenge.physicalRotation.length;
  const scheduledIds = challenge.physicalRotation[rotationIndex];

  return scheduledIds.flatMap((activityId) => {
    const physicalActivity = challenge.physicalActivities.find(
      (activity) => activity.id === activityId,
    );

    // Unreachable for a parsed fixture — `challengeSchema` refuses a rotation
    // that names an unknown activity — but flatMap lets an unknown id drop out
    // rather than putting an undefined into the checklist.
    if (!physicalActivity) return [];

    return [
      {
        // The id embeds the activity slug rather than its position in the day,
        // so reordering a rotation entry does not silently re-point completions
        // that were already written against it.
        id: `day-${dayIndex}-${physicalActivity.id}`,
        category: 'physical' as const,
        label: physicalActivity.label,
        detail: physicalActivity.detail,
      },
    ];
  });
}

function buildReadingActivity(
  challenge: Challenge,
  dayIndex: number,
  dayOffset: number,
  track: ChallengeBookTrack,
  books: readonly ChallengeBook[],
): ChallengeActivity[] {
  const book = selectBookForDay(books, track, dayOffset);
  if (!book) return [];

  const pages = challenge.readingPagesPerSession;

  return [
    {
      // The slot is what is being tracked, not the book: `day-4-growth-reading`
      // stays the same id whichever book that day's rotation lands on.
      id: `day-${dayIndex}-${track === 'technical' ? 'technical' : 'growth'}-reading`,
      category:
        track === 'technical' ? ('technical_reading' as const) : ('growth_reading' as const),
      label: book.title,
      detail: `${pages} pages · ${book.author}`,
      bookId: book.id,
      pages,
    },
  ];
}

export function buildDayPlan(
  challenge: Challenge,
  books: readonly ChallengeBook[],
  dayIndex: number,
): ChallengeDayPlan | null {
  const date = getDateKeyForDayIndex(challenge, dayIndex);
  if (date === null) return null;

  const dayOffset = dayIndex - 1;

  return {
    dayIndex,
    date,
    activities: [
      ...buildPhysicalActivities(challenge, dayIndex, dayOffset),
      ...buildReadingActivity(challenge, dayIndex, dayOffset, 'technical', books),
      ...buildReadingActivity(challenge, dayIndex, dayOffset, 'growth', books),
      {
        id: `day-${dayIndex}-reflection`,
        category: 'reflection' as const,
        label: 'Daily reflection',
        detail: `${challenge.reflectionLineCount} lines: what moved, what stalled, what is next`,
      },
    ],
  };
}

export function buildAllDayPlans(
  challenge: Challenge,
  books: readonly ChallengeBook[],
): ChallengeDayPlan[] {
  return Array.from({ length: challenge.totalDays }, (_, index) => index + 1).flatMap(
    (dayIndex) => {
      const plan = buildDayPlan(challenge, books, dayIndex);

      return plan ? [plan] : [];
    },
  );
}
