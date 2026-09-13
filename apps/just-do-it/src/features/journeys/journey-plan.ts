import { differenceInCalendarDays, parseISO } from 'date-fns';

import { addJourneyDays } from './journey-data';
import {
  JOURNEY_PHYSICAL_TRACK_VALUES,
  type Journey,
  type JourneyActivity,
  type JourneyBook,
  type JourneyBookTrack,
  type JourneyDayPlan,
  type JourneyEnrollment,
  type JourneyPhysicalActivity,
  type JourneyPhysicalFocus,
  type JourneyPhysicalTrack,
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

// Physical work is drawn exactly the way the books are, and for the same
// reason: a fixed rotation repeats itself. A seven-day rotation over a hundred
// days shows the same seven combinations fourteen times however many movements
// the journey defines, so the day deals from a seeded permutation instead —
// every movement comes up once per pass, the order inside a pass looks
// arbitrary, and the next pass is reshuffled.
//
// One movement is drawn per track rather than N from one pool, which is what
// keeps the hundred days survivable: `main` asks something of you, `easy` is the
// walk or the mobility that still counts as a day of movement.
export function selectPhysicalActivitiesForTrack(
  activities: readonly JourneyPhysicalActivity[],
  track: JourneyPhysicalTrack,
): JourneyPhysicalActivity[] {
  return activities.filter((activity) => activity.track === track);
}

// Dealing each movement once per pass keeps the movements varied and the load
// even, but it says nothing about what they tax — a shuffle is perfectly happy
// to follow push-ups with a floor press with more push-ups, and over a hundred
// days that happened on twenty-seven adjacent pairs, including runs of three.
// So the shuffled pass is re-ordered greedily: take the next movement whose
// focus differs from the one just used, and fall back to the first remaining
// only when everything left shares that focus. Nothing is added or dropped, so
// every movement still comes up exactly once per pass.
export function spaceOutPhysicalFocus(
  shuffled: readonly JourneyPhysicalActivity[],
  previousFocus: JourneyPhysicalFocus | null,
): JourneyPhysicalActivity[] {
  const remaining = [...shuffled];
  const arranged: JourneyPhysicalActivity[] = [];
  let lastFocus = previousFocus;

  while (remaining.length > 0) {
    const nextIndex = remaining.findIndex((activity) => activity.focus !== lastFocus);
    const [next] = remaining.splice(nextIndex === -1 ? 0 : nextIndex, 1);

    arranged.push(next);
    lastFocus = next.focus;
  }

  return arranged;
}

// Cycles are built from the first rather than jumped to, because the last
// movement of one pass has to be known before the next pass can avoid repeating
// its focus — a boundary clash is exactly as tiring as one in the middle. Seven
// passes of fifteen over a hundred days, so walking them costs nothing, and
// building them rather than caching keeps this a pure function.
function buildPhysicalArrangement(
  trackActivities: readonly JourneyPhysicalActivity[],
  track: JourneyPhysicalTrack,
  cycleIndex: number,
): JourneyPhysicalActivity[] {
  let previousFocus: JourneyPhysicalFocus | null = null;
  let arranged: JourneyPhysicalActivity[] = [];

  for (let cycle = 0; cycle <= cycleIndex; cycle += 1) {
    const order = buildSeededPermutation(
      trackActivities.length,
      hashSeed(`physical:${track}:${cycle}`),
    );

    arranged = spaceOutPhysicalFocus(
      order.map((index) => trackActivities[index]),
      previousFocus,
    );
    previousFocus = arranged[arranged.length - 1]?.focus ?? null;
  }

  return arranged;
}

function selectPhysicalActivityForDay(
  journey: Journey,
  track: JourneyPhysicalTrack,
  dayOffset: number,
): JourneyPhysicalActivity | null {
  const trackActivities = selectPhysicalActivitiesForTrack(journey.physicalActivities, track);
  if (trackActivities.length === 0) return null;

  const cycleIndex = Math.floor(dayOffset / trackActivities.length);
  const positionInCycle = dayOffset % trackActivities.length;

  return buildPhysicalArrangement(trackActivities, track, cycleIndex)[positionInCycle];
}

// The movement is randomised; the effort is not. A movement's levels are spread
// evenly across the journey, so the same push-ups that asked for thirty on day
// one ask for sixty by the end — and where more reps stop meaning more, a level
// raises the difficulty at the same reps instead. Progress comes from where you
// are in the hundred days, never from which movement the shuffle dealt.
export function selectPhysicalLevelIndex(
  activity: JourneyPhysicalActivity,
  journey: Journey,
  dayIndex: number,
): number {
  const lastIndex = activity.levels.length - 1;
  if (lastIndex <= 0) return 0;

  const progressed = Math.floor(((dayIndex - 1) * activity.levels.length) / journey.totalDays);

  return Math.min(lastIndex, Math.max(0, progressed));
}

function buildPhysicalActivities(
  journey: Journey,
  dayIndex: number,
  dayOffset: number,
): JourneyActivity[] {
  return JOURNEY_PHYSICAL_TRACK_VALUES.flatMap((track) => {
    const activity = selectPhysicalActivityForDay(journey, track, dayOffset);
    if (!activity) return [];

    const levelIndex = selectPhysicalLevelIndex(activity, journey, dayIndex);
    const level = activity.levels[levelIndex];

    return [
      {
        // The id is the movement, not the level, so a movement that levels up on
        // day twenty-six does not orphan the ticks written against it before.
        id: `day-${dayIndex}-${activity.id}`,
        category: 'physical' as const,
        label: level.label,
        detail:
          activity.levels.length > 1
            ? `Level ${levelIndex + 1} of ${activity.levels.length} · ${level.detail}`
            : level.detail,
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
