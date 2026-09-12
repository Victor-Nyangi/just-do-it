import { describe, expect, it } from 'vitest';

import { getInitialJourneyEnrollments, getInitialJourneys } from './journey-data';
import {
  buildAllDayPlans,
  buildDayPlan,
  clampDayIndex,
  getCurrentDayIndex,
  getDateKeyForDayIndex,
  getDayIndexForDate,
  getEndDateKey,
  isValidDayIndex,
  selectBooksForTrack,
} from './journey-plan';
import type { JourneyEnrollment } from './types';

const [discipline, deepWork] = getInitialJourneys();
const [enrollment] = getInitialJourneyEnrollments();

function planFor(dayIndex: number) {
  const plan = buildDayPlan(discipline, enrollment, dayIndex);

  if (!plan) throw new Error(`No plan for day ${dayIndex}`);

  return plan;
}

function bookIdForCategory(dayIndex: number, category: string): string | undefined {
  return planFor(dayIndex).activities.find((activity) => activity.category === category)?.bookId;
}

describe('day index and date mapping', () => {
  it('puts day one on the enrollment start date', () => {
    expect(getDateKeyForDayIndex(discipline, enrollment, 1)).toBe(enrollment.startDate);
    expect(getEndDateKey(discipline, enrollment)).toBe('2026-12-20');
  });

  // The same journey started on a different date is a different set of dates
  // over the same plan. This is the split that makes journeys reusable.
  it('moves every date when the same journey starts on another day', () => {
    const laterEnrollment: JourneyEnrollment = {
      ...enrollment,
      id: 'later',
      startDate: '2027-01-01',
    };

    expect(getDateKeyForDayIndex(discipline, laterEnrollment, 1)).toBe('2027-01-01');
    expect(getEndDateKey(discipline, laterEnrollment)).toBe('2027-04-10');
    // The plan itself is untouched — only the dates move.
    expect(buildDayPlan(discipline, laterEnrollment, 1)?.activities.map((a) => a.id)).toEqual(
      planFor(1).activities.map((a) => a.id),
    );
  });

  it('maps a date back to its day index', () => {
    expect(getDayIndexForDate(discipline, enrollment, new Date(2026, 8, 12, 12))).toBe(1);
    expect(getDayIndexForDate(discipline, enrollment, new Date(2026, 8, 21, 12))).toBe(10);
    expect(getDayIndexForDate(discipline, enrollment, new Date(2026, 11, 20, 12))).toBe(100);
  });

  it('has no day index outside the window', () => {
    expect(getDayIndexForDate(discipline, enrollment, new Date(2026, 8, 11, 12))).toBeNull();
    expect(getDayIndexForDate(discipline, enrollment, new Date(2026, 11, 21, 12))).toBeNull();
    expect(getCurrentDayIndex(discipline, enrollment, new Date(2025, 0, 1, 12))).toBeNull();
  });

  it('rejects day indexes off the ends and between the whole numbers', () => {
    expect(isValidDayIndex(discipline, 0)).toBe(false);
    expect(isValidDayIndex(discipline, 101)).toBe(false);
    expect(isValidDayIndex(discipline, 1.5)).toBe(false);
    expect(isValidDayIndex(discipline, 1)).toBe(true);
  });

  // The bound is the journey's own length, not a constant.
  it('bounds each journey by its own length', () => {
    expect(isValidDayIndex(deepWork, 31)).toBe(false);
    expect(isValidDayIndex(deepWork, 30)).toBe(true);
    expect(clampDayIndex(deepWork, 250)).toBe(30);
    expect(clampDayIndex(discipline, 250)).toBe(100);
  });

  it('clamps a day index into the window rather than refusing it', () => {
    expect(clampDayIndex(discipline, -4)).toBe(1);
    expect(clampDayIndex(discipline, 42)).toBe(42);
    expect(clampDayIndex(discipline, Number.NaN)).toBe(1);
  });

  it('builds no plan for a day outside the window', () => {
    expect(buildDayPlan(discipline, enrollment, 0)).toBeNull();
    expect(buildDayPlan(discipline, enrollment, 101)).toBeNull();
  });
});

describe('buildDayPlan — determinism', () => {
  // The whole design rests on this: plans are generated rather than stored, so
  // a day that changed between renders would silently re-point every completion
  // written against it.
  it('builds the identical plan every time it is asked', () => {
    for (const dayIndex of [1, 17, 58, 100]) {
      expect(buildDayPlan(discipline, enrollment, dayIndex)).toEqual(
        buildDayPlan(discipline, enrollment, dayIndex),
      );
    }
  });

  it('builds the same plan from a separately parsed copy of the fixtures', () => {
    expect(buildDayPlan(getInitialJourneys()[0], enrollment, 42)).toEqual(
      buildDayPlan(discipline, enrollment, 42),
    );
  });
});

describe('buildDayPlan — physical rotation', () => {
  it('gives day one the first rotation entry', () => {
    expect(planFor(1).activities.map((activity) => activity.id)).toEqual([
      'day-1-walk-1km',
      'day-1-push-ups-50',
      'day-1-technical-reading',
      'day-1-growth-reading',
      'day-1-reflection',
    ]);
  });

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
    expect(planFor(4).activities.filter((a) => a.category === 'physical')).toHaveLength(1);
    expect(planFor(5).activities.filter((a) => a.category === 'physical')).toHaveLength(3);
  });

  // An empty rotation would divide by zero in the modulo that picks the day's
  // entry, so this is a guard rather than a preference.
  it('schedules no physical work for a journey that defines none', () => {
    const deepWorkEnrollment: JourneyEnrollment = {
      ...enrollment,
      id: 'deep',
      journeyId: deepWork.id,
    };
    const plan = buildDayPlan(deepWork, deepWorkEnrollment, 1);

    expect(plan?.activities.some((activity) => activity.category === 'physical')).toBe(false);
    expect(plan?.activities).toHaveLength(2);
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

  // A journey with only one track schedules only that one, rather than leaving
  // an empty slot.
  it('schedules nothing for a track with no books', () => {
    const deepWorkEnrollment: JourneyEnrollment = {
      ...enrollment,
      id: 'deep',
      journeyId: deepWork.id,
    };
    const plan = buildDayPlan(deepWork, deepWorkEnrollment, 1);

    expect(plan?.activities.filter((a) => a.category === 'technical_reading')).toHaveLength(1);
    expect(plan?.activities.filter((a) => a.category === 'growth_reading')).toHaveLength(0);
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
    const technicalCount = selectBooksForTrack(discipline.books, 'technical').length;

    for (const cycleIndex of [0, 1, 5]) {
      const cycleBookIds = Array.from({ length: technicalCount }, (_, offset) =>
        bookIdForCategory(cycleIndex * technicalCount + offset + 1, 'technical_reading'),
      );

      expect(new Set(cycleBookIds).size).toBe(technicalCount);
    }
  });

  it('covers every growth book exactly once per thirteen-day cycle', () => {
    const growthCount = selectBooksForTrack(discipline.books, 'growth').length;
    const cycleBookIds = Array.from({ length: growthCount }, (_, offset) =>
      bookIdForCategory(offset + 1, 'growth_reading'),
    );

    expect(new Set(cycleBookIds).size).toBe(growthCount);
  });

  it('shuffles each cycle differently rather than repeating fixture order', () => {
    const technicalCount = selectBooksForTrack(discipline.books, 'technical').length;
    const orderFor = (cycleIndex: number) =>
      Array.from({ length: technicalCount }, (_, offset) =>
        bookIdForCategory(cycleIndex * technicalCount + offset + 1, 'technical_reading'),
      );

    expect(orderFor(1)).not.toEqual(orderFor(0));
  });
});

describe('buildAllDayPlans', () => {
  it('builds one plan per day of the journey', () => {
    const plans = buildAllDayPlans(discipline, enrollment);

    expect(plans).toHaveLength(100);
    expect(plans[0].dayIndex).toBe(1);
    expect(plans[99].dayIndex).toBe(100);
  });

  it('builds a shorter journey to its own length', () => {
    const deepWorkEnrollment: JourneyEnrollment = {
      ...enrollment,
      id: 'deep',
      journeyId: deepWork.id,
    };

    expect(buildAllDayPlans(deepWork, deepWorkEnrollment)).toHaveLength(30);
  });

  it('gives every activity across the journey a distinct id', () => {
    const activityIds = buildAllDayPlans(discipline, enrollment).flatMap((plan) =>
      plan.activities.map((activity) => activity.id),
    );

    expect(new Set(activityIds).size).toBe(activityIds.length);
  });

  it('always closes a day with its reflection', () => {
    for (const plan of buildAllDayPlans(discipline, enrollment)) {
      expect(plan.activities.at(-1)).toMatchObject({
        category: 'reflection',
        id: `day-${plan.dayIndex}-reflection`,
      });
    }
  });
});
