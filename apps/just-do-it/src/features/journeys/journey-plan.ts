import { differenceInCalendarDays, parseISO } from 'date-fns';

import { addJourneyDays } from './journey-data';
import type {
  Journey,
  JourneyActivity,
  JourneyBook,
  JourneyBookTrack,
  JourneyDayPlan,
  JourneyEnrollment,
} from './types';

// A day's plan is generated, not stored: it is a pure function of the journey
// definition and the day index, so the same day always yields the same plan on
// every device and every render, and a hundred days of rows never have to be
// written by hand.
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
  books: readonly JourneyBook[],
  track: JourneyBookTrack,
): JourneyBook[] {
  return books.filter((book) => book.track === track);
}

// `dayOffset` is zero-based (day 1 of a journey is offset 0), because every
// rotation below is modular arithmetic and a one-based index would put day 1 in
// the second slot.
function selectBookForDay(
  books: readonly JourneyBook[],
  track: JourneyBookTrack,
  dayOffset: number,
): JourneyBook | null {
  const trackBooks = selectBooksForTrack(books, track);
  if (trackBooks.length === 0) return null;

  const cycleIndex = Math.floor(dayOffset / trackBooks.length);
  const positionInCycle = dayOffset % trackBooks.length;
  const order = buildSeededPermutation(trackBooks.length, hashSeed(`${track}:${cycleIndex}`));

  return trackBooks[order[positionInCycle]];
}

export function isValidDayIndex(journey: Journey, dayIndex: number): boolean {
  return Number.isInteger(dayIndex) && dayIndex >= 1 && dayIndex <= journey.totalDays;
}

export function clampDayIndex(journey: Journey, dayIndex: number): number {
  if (!Number.isFinite(dayIndex)) return 1;

  return Math.min(journey.totalDays, Math.max(1, Math.round(dayIndex)));
}

// Dates come from the enrollment, never the journey — the same journey started
// on two different dates is two different sets of dates over the same plan.
export function getEndDateKey(journey: Journey, enrollment: JourneyEnrollment): string {
  return addJourneyDays(enrollment.startDate, journey.totalDays - 1);
}

export function getDateKeyForDayIndex(
  journey: Journey,
  enrollment: JourneyEnrollment,
  dayIndex: number,
): string | null {
  if (!isValidDayIndex(journey, dayIndex)) return null;

  return addJourneyDays(enrollment.startDate, dayIndex - 1);
}

export function getDayIndexForDate(
  journey: Journey,
  enrollment: JourneyEnrollment,
  date: Date,
): number | null {
  const dayIndex = differenceInCalendarDays(date, parseISO(enrollment.startDate)) + 1;

  return isValidDayIndex(journey, dayIndex) ? dayIndex : null;
}

// Null before the journey opens and after it closes, which the routes render as
// their own states rather than pretending some day is current.
export function getCurrentDayIndex(
  journey: Journey,
  enrollment: JourneyEnrollment,
  now: Date = new Date(),
): number | null {
  return getDayIndexForDate(journey, enrollment, now);
}

function buildPhysicalActivities(
  journey: Journey,
  dayIndex: number,
  dayOffset: number,
): JourneyActivity[] {
  // A journey with no physical work has an empty rotation, and the modulo below
  // would divide by zero.
  if (journey.physicalRotation.length === 0) return [];

  const rotationIndex = dayOffset % journey.physicalRotation.length;
  const scheduledIds = journey.physicalRotation[rotationIndex];

  return scheduledIds.flatMap((activityId) => {
    const physicalActivity = journey.physicalActivities.find(
      (activity) => activity.id === activityId,
    );

    // Unreachable for a parsed journey — `journeySchema` refuses a rotation
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
  journey: Journey,
  dayIndex: number,
  dayOffset: number,
  track: JourneyBookTrack,
): JourneyActivity[] {
  const book = selectBookForDay(journey.books, track, dayOffset);
  if (!book) return [];

  const pages = journey.readingPagesPerSession;

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

function buildReflectionActivity(journey: Journey, dayIndex: number): JourneyActivity[] {
  if (journey.reflectionLineCount <= 0) return [];

  return [
    {
      id: `day-${dayIndex}-reflection`,
      category: 'reflection' as const,
      label: 'Daily reflection',
      detail: `${journey.reflectionLineCount} lines: what moved, what stalled, what is next`,
    },
  ];
}

export function buildDayPlan(
  journey: Journey,
  enrollment: JourneyEnrollment,
  dayIndex: number,
): JourneyDayPlan | null {
  const date = getDateKeyForDayIndex(journey, enrollment, dayIndex);
  if (date === null) return null;

  const dayOffset = dayIndex - 1;

  return {
    dayIndex,
    date,
    activities: [
      ...buildPhysicalActivities(journey, dayIndex, dayOffset),
      ...buildReadingActivity(journey, dayIndex, dayOffset, 'technical'),
      ...buildReadingActivity(journey, dayIndex, dayOffset, 'growth'),
      ...buildReflectionActivity(journey, dayIndex),
    ],
  };
}

export function buildAllDayPlans(
  journey: Journey,
  enrollment: JourneyEnrollment,
): JourneyDayPlan[] {
  return Array.from({ length: journey.totalDays }, (_, index) => index + 1).flatMap((dayIndex) => {
    const plan = buildDayPlan(journey, enrollment, dayIndex);

    return plan ? [plan] : [];
  });
}
