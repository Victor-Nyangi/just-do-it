import { describe, expect, it } from 'vitest';

import { getInitialChallenge, getInitialChallengeBooks } from './challenge-data';
import {
  buildAllDayPlans,
  buildDayPlan,
  clampDayIndex,
  getCurrentDayIndex,
  getDateKeyForDayIndex,
  getDayIndexForDate,
  isValidDayIndex,
  selectBooksForTrack,
} from './challenge-plan';

const challenge = getInitialChallenge();
const books = getInitialChallengeBooks();

function planFor(dayIndex: number) {
  const plan = buildDayPlan(challenge, books, dayIndex);

  if (!plan) throw new Error(`No plan for day ${dayIndex}`);

  return plan;
}

function activityIdsFor(dayIndex: number): string[] {
  return planFor(dayIndex).activities.map((activity) => activity.id);
}

function bookIdForCategory(dayIndex: number, category: string): string | undefined {
  return planFor(dayIndex).activities.find((activity) => activity.category === category)?.bookId;
}

describe('day index and date mapping', () => {
  it('puts day one on the start date and day one hundred on the end date', () => {
    expect(getDateKeyForDayIndex(challenge, 1)).toBe(challenge.startDate);
    expect(getDateKeyForDayIndex(challenge, 100)).toBe(challenge.endDate);
  });

  it('maps a date back to its day index', () => {
    expect(getDayIndexForDate(challenge, new Date(2026, 8, 11, 12))).toBe(1);
    expect(getDayIndexForDate(challenge, new Date(2026, 8, 20, 12))).toBe(10);
    expect(getDayIndexForDate(challenge, new Date(2026, 11, 19, 12))).toBe(100);
  });

  // Outside the window there is no current day, and saying so is the point:
  // the routes render their own before/after states rather than pretending
  // some day is in progress.
  it('has no day index outside the window', () => {
    expect(getDayIndexForDate(challenge, new Date(2026, 8, 10, 12))).toBeNull();
    expect(getDayIndexForDate(challenge, new Date(2026, 11, 20, 12))).toBeNull();
    expect(getCurrentDayIndex(challenge, new Date(2025, 0, 1, 12))).toBeNull();
  });

  it('rejects day indexes off the ends and between the whole numbers', () => {
    expect(isValidDayIndex(challenge, 0)).toBe(false);
    expect(isValidDayIndex(challenge, 101)).toBe(false);
    expect(isValidDayIndex(challenge, 1.5)).toBe(false);
    expect(isValidDayIndex(challenge, 1)).toBe(true);
  });

  it('clamps a day index into the window rather than refusing it', () => {
    expect(clampDayIndex(challenge, -4)).toBe(1);
    expect(clampDayIndex(challenge, 250)).toBe(100);
    expect(clampDayIndex(challenge, 42)).toBe(42);
    expect(clampDayIndex(challenge, Number.NaN)).toBe(1);
  });

  it('builds no plan for a day outside the window', () => {
    expect(buildDayPlan(challenge, books, 0)).toBeNull();
    expect(buildDayPlan(challenge, books, 101)).toBeNull();
  });
});

describe('buildDayPlan — determinism', () => {
  // The whole design rests on this: plans are generated rather than stored, so
  // a day that changed between renders would silently re-point every
  // completion written against it.
  it('builds the identical plan every time it is asked', () => {
    for (const dayIndex of [1, 17, 58, 100]) {
      expect(buildDayPlan(challenge, books, dayIndex)).toEqual(
        buildDayPlan(challenge, books, dayIndex),
      );
    }
  });

  it('builds the same plan from a separately parsed copy of the fixtures', () => {
    expect(buildDayPlan(getInitialChallenge(), getInitialChallengeBooks(), 42)).toEqual(
      buildDayPlan(challenge, books, 42),
    );
  });
});

describe('buildDayPlan — physical rotation', () => {
  it('gives day one the first rotation entry', () => {
    expect(activityIdsFor(1)).toEqual([
      'day-1-walk-1km',
      'day-1-push-ups-50',
      'day-1-technical-reading',
      'day-1-growth-reading',
      'day-1-reflection',
    ]);
  });

  // The rotation is seven long, so day 8 repeats day 1's physical work.
  it('repeats the physical rotation every seven days', () => {
    const physicalSlugs = (dayIndex: number) =>
      planFor(dayIndex)
        .activities.filter((activity) => activity.category === 'physical')
        .map((activity) => activity.id.replace(`day-${dayIndex}-`, ''));

    expect(physicalSlugs(8)).toEqual(physicalSlugs(1));
    expect(physicalSlugs(15)).toEqual(physicalSlugs(1));
    expect(physicalSlugs(9)).toEqual(physicalSlugs(2));
  });

  it('varies how much physical work a day carries', () => {
    // Day 4 is the single-activity day and day 5 the full one, which is what
    // makes the rotation a rotation rather than the same day a hundred times.
    expect(planFor(4).activities.filter((a) => a.category === 'physical')).toHaveLength(1);
    expect(planFor(5).activities.filter((a) => a.category === 'physical')).toHaveLength(3);
  });
});

describe('buildDayPlan — reading rotation', () => {
  it('schedules one book from each track every day', () => {
    for (const dayIndex of [1, 2, 33, 100]) {
      const plan = planFor(dayIndex);

      expect(plan.activities.filter((a) => a.category === 'technical_reading')).toHaveLength(1);
      expect(plan.activities.filter((a) => a.category === 'growth_reading')).toHaveLength(1);
    }
  });

  it('attaches the page count and the book to a reading activity', () => {
    const reading = planFor(1).activities.find((a) => a.category === 'technical_reading');

    expect(reading).toMatchObject({
      id: 'day-1-technical-reading',
      bookId: 'micro-frontends-in-action',
      label: 'Micro Frontends in Action',
      pages: 10,
    });
    expect(reading?.detail).toContain('10 pages');
  });

  // A plain modulo would cycle in fixture order forever; a seeded shuffle per
  // cycle keeps coverage even while making the order look arbitrary. Both
  // halves are asserted here, because losing either breaks the requirement.
  it('covers every technical book exactly once per six-day cycle', () => {
    const technicalCount = selectBooksForTrack(books, 'technical').length;

    for (const cycleIndex of [0, 1, 5]) {
      const cycleBookIds = Array.from({ length: technicalCount }, (_, offset) =>
        bookIdForCategory(cycleIndex * technicalCount + offset + 1, 'technical_reading'),
      );

      expect(new Set(cycleBookIds).size).toBe(technicalCount);
    }
  });

  it('covers every growth book exactly once per thirteen-day cycle', () => {
    const growthCount = selectBooksForTrack(books, 'growth').length;
    const cycleBookIds = Array.from({ length: growthCount }, (_, offset) =>
      bookIdForCategory(offset + 1, 'growth_reading'),
    );

    expect(new Set(cycleBookIds).size).toBe(growthCount);
  });

  it('shuffles each cycle differently rather than repeating fixture order', () => {
    const technicalCount = selectBooksForTrack(books, 'technical').length;
    const orderFor = (cycleIndex: number) =>
      Array.from({ length: technicalCount }, (_, offset) =>
        bookIdForCategory(cycleIndex * technicalCount + offset + 1, 'technical_reading'),
      );

    expect(orderFor(1)).not.toEqual(orderFor(0));
  });
});

describe('buildAllDayPlans', () => {
  it('builds one plan per day of the challenge', () => {
    const plans = buildAllDayPlans(challenge, books);

    expect(plans).toHaveLength(100);
    expect(plans[0].dayIndex).toBe(1);
    expect(plans[99].dayIndex).toBe(100);
  });

  it('gives every activity across the challenge a distinct id', () => {
    const activityIds = buildAllDayPlans(challenge, books).flatMap((plan) =>
      plan.activities.map((activity) => activity.id),
    );

    expect(new Set(activityIds).size).toBe(activityIds.length);
  });

  it('always closes a day with its reflection', () => {
    for (const plan of buildAllDayPlans(challenge, books)) {
      expect(plan.activities.at(-1)).toMatchObject({
        category: 'reflection',
        id: `day-${plan.dayIndex}-reflection`,
      });
    }
  });
});
