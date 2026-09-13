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
  selectPhysicalLevelIndex,
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

function physicalSlugs(dayIndex: number): string[] {
  return planFor(dayIndex)
    .activities.filter((activity) => activity.category === 'physical')
    .map((activity) => activity.id.replace(`day-${dayIndex}-`, ''));
}

function movementById(activityId: string) {
  const movement = discipline.physicalActivities.find((entry) => entry.id === activityId);
  if (!movement) throw new Error(`Expected a movement called ${activityId}`);

  return movement;
}

describe('buildDayPlan — physical work', () => {
  // One from each track every day, which is the guard on the whole point of the
  // split: a hundred days of movement rather than a hundred hard workouts.
  it('draws exactly one movement from each track', () => {
    for (const dayIndex of [1, 2, 17, 58, 100]) {
      const tracks = physicalSlugs(dayIndex).map((slug) => movementById(slug).track);

      expect(tracks.toSorted()).toEqual(['easy', 'main']);
    }
  });

  // The whole reason the rotation went: seven entries repeated fourteen times
  // over a hundred days, however many movements the journey defined.
  it('does not repeat itself every seven days', () => {
    expect(physicalSlugs(8)).not.toEqual(physicalSlugs(1));
    expect(physicalSlugs(15)).not.toEqual(physicalSlugs(1));
  });

  it('is deterministic, so the same day always deals the same movements', () => {
    expect(physicalSlugs(42)).toEqual(physicalSlugs(42));
    expect(buildDayPlan(discipline, enrollment, 42)).toEqual(
      buildDayPlan(discipline, enrollment, 42),
    );
  });

  // Every movement on a track comes up exactly once per pass through it, which
  // is what keeps the load even rather than leaving a movement unused for a
  // hundred days while another lands every third day.
  it('deals every movement on a track once per pass', () => {
    for (const track of ['main', 'easy'] as const) {
      const trackMovements = discipline.physicalActivities.filter((entry) => entry.track === track);
      const firstPass = Array.from({ length: trackMovements.length }, (_, index) =>
        physicalSlugs(index + 1).find((slug) => movementById(slug).track === track),
      );

      expect(new Set(firstPass).size).toBe(trackMovements.length);
    }
  });

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

describe('buildDayPlan — levelling up', () => {
  function levelFor(dayIndex: number, activityId: string): string | null {
    const activity = planFor(dayIndex).activities.find(
      (entry) => entry.id === `day-${dayIndex}-${activityId}`,
    );

    return activity?.label ?? null;
  }

  it('opens the journey on the first level of whatever it deals', () => {
    for (const slug of physicalSlugs(1)) {
      expect(levelFor(1, slug)).toBe(movementById(slug).levels[0].label);
    }
  });

  it('closes the journey on the last level', () => {
    for (const slug of physicalSlugs(100)) {
      expect(levelFor(100, slug)).toBe(movementById(slug).levels.at(-1)?.label);
    }
  });

  // The level comes from where the day sits in the hundred, never from which
  // movement the shuffle dealt, so a movement asks for the same thing whenever
  // it lands on a given day.
  it('takes the level from the day rather than from the draw', () => {
    const pushUps = movementById('push-ups');
    const levelOn = (dayIndex: number) => selectPhysicalLevelIndex(pushUps, discipline, dayIndex);

    expect(levelOn(1)).toBe(0);
    expect(levelOn(100)).toBe(pushUps.levels.length - 1);
    expect(levelOn(50)).toBeGreaterThan(levelOn(1));
    expect(levelOn(50)).toBeLessThan(levelOn(100));
  });

  it('never steps backwards as the journey runs', () => {
    const movement = movementById('squats');
    let previous = 0;

    for (let dayIndex = 1; dayIndex <= discipline.totalDays; dayIndex += 1) {
      const level = selectPhysicalLevelIndex(movement, discipline, dayIndex);

      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }

    expect(previous).toBe(movement.levels.length - 1);
  });

  // A single-level movement has nothing to advertise, so it is spared the
  // "Level 1 of 1" noise.
  it('names the level in the detail only when there is more than one', () => {
    const single = {
      ...movementById('squats'),
      id: 'single',
      levels: [{ label: 'One rung', detail: 'Only rung' }],
    };
    const journey = { ...discipline, physicalActivities: [single] };
    const plan = buildDayPlan(journey, enrollment, 1);

    expect(plan?.activities[0]).toMatchObject({ label: 'One rung', detail: 'Only rung' });
    expect(planFor(1).activities[0].detail).toMatch(/^Level 1 of \d+ · /);
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
