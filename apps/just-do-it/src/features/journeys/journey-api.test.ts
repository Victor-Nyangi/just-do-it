import { beforeEach, describe, expect, it } from 'vitest';

import { completeJourneyActivity, getJourneyDay, getJourneyStats } from './journey-api';
import {
  getInitialJourneyCompletions,
  getInitialJourneyEnrollments,
  getInitialJourneys,
} from './journey-data';
import { useJourneyStore } from './journey-store';

const ENROLLMENT_ID = 'enrollment-discipline';

// These three functions are the in-process stand-ins for the specified
// endpoints, so this file is the closest thing the POC has to endpoint tests:
// it pins the contracts a real GET/POST would have to keep.
beforeEach(() => {
  useJourneyStore.setState({
    journeys: getInitialJourneys(),
    enrollments: getInitialJourneyEnrollments(),
    completions: getInitialJourneyCompletions(),
  });
});

describe('getJourneyDay — GET /api/enrollments/[id]/day/[dayIndex]', () => {
  it('returns the day plan alongside its completion state', () => {
    const response = getJourneyDay(ENROLLMENT_ID, 1);

    expect(response).toMatchObject({
      enrollmentId: ENROLLMENT_ID,
      journeyId: 'hundred-day-discipline',
      dayIndex: 1,
      date: '2026-09-12',
      completedCount: 2,
      activityCount: 5,
      complete: false,
    });
    expect(response?.plan.activities).toHaveLength(5);
  });

  it('lists the completed ids in plan order rather than tick order', () => {
    completeJourneyActivity(ENROLLMENT_ID, 1, 'day-1-reflection');

    expect(getJourneyDay(ENROLLMENT_ID, 1)?.completedActivityIds).toEqual([
      'day-1-walk-1km',
      'day-1-technical-reading',
      'day-1-reflection',
    ]);
  });

  it('reports an untouched day as untouched', () => {
    expect(getJourneyDay(ENROLLMENT_ID, 2)).toMatchObject({ completedCount: 0, complete: false });
  });

  // Null is this layer's 404, for both halves of the address.
  it('has no day outside the journey and no unknown enrollment', () => {
    expect(getJourneyDay(ENROLLMENT_ID, 0)).toBeNull();
    expect(getJourneyDay(ENROLLMENT_ID, 101)).toBeNull();
    expect(getJourneyDay('nope', 1)).toBeNull();
  });

  it('bounds a shorter journey by its own length', () => {
    const enrollmentId = useJourneyStore
      .getState()
      .enrollInJourney('deep-work-reset', '2026-09-12');

    if (!enrollmentId) throw new Error('Expected an enrollment');

    expect(getJourneyDay(enrollmentId, 30)).toMatchObject({ activityCount: 2 });
    expect(getJourneyDay(enrollmentId, 31)).toBeNull();
  });
});

describe('completeJourneyActivity — POST /api/enrollments/[id]/day/[dayIndex]/complete', () => {
  it('toggles an activity on and returns the day as it now stands', () => {
    const response = completeJourneyActivity(ENROLLMENT_ID, 1, 'day-1-reflection');

    expect(response).toMatchObject({ dayIndex: 1, completedCount: 3 });
    expect(response?.completedActivityIds).toContain('day-1-reflection');
  });

  it('toggles the same activity back off', () => {
    completeJourneyActivity(ENROLLMENT_ID, 1, 'day-1-reflection');

    expect(completeJourneyActivity(ENROLLMENT_ID, 1, 'day-1-reflection')?.completedCount).toBe(2);
  });

  it('reports the day complete once nothing is left', () => {
    for (const activityId of ['day-1-push-ups-50', 'day-1-growth-reading', 'day-1-reflection']) {
      completeJourneyActivity(ENROLLMENT_ID, 1, activityId);
    }

    expect(getJourneyDay(ENROLLMENT_ID, 1)).toMatchObject({ completedCount: 5, complete: true });
  });

  it('leaves the day untouched when the activity is not one of its own', () => {
    expect(completeJourneyActivity(ENROLLMENT_ID, 1, 'day-1-swim-2km')?.completedCount).toBe(2);
    expect(useJourneyStore.getState().completions).toHaveLength(2);
  });

  it('has nothing to post to outside the journey or for an unknown enrollment', () => {
    expect(completeJourneyActivity(ENROLLMENT_ID, 101, 'day-101-reflection')).toBeNull();
    expect(completeJourneyActivity('nope', 1, 'day-1-reflection')).toBeNull();
  });
});

describe('getJourneyStats — GET /api/enrollments/[id]/stats', () => {
  it('returns the streak, the total done, and the activity count', () => {
    expect(getJourneyStats(ENROLLMENT_ID, new Date(2026, 8, 12, 12))).toMatchObject({
      currentDayIndex: 1,
      currentStreak: 0,
      completedActivityCount: 2,
      totalActivityCount: 486,
    });
  });

  it('moves once an activity is completed through the API', () => {
    completeJourneyActivity(ENROLLMENT_ID, 2, 'day-2-reflection');

    expect(getJourneyStats(ENROLLMENT_ID, new Date(2026, 8, 13, 12))?.completedActivityCount).toBe(
      3,
    );
  });

  it('counts a streak built through the API', () => {
    const dayOne = getJourneyDay(ENROLLMENT_ID, 1);

    for (const activity of dayOne?.plan.activities ?? []) {
      if (!dayOne?.completedActivityIds.includes(activity.id)) {
        completeJourneyActivity(ENROLLMENT_ID, 1, activity.id);
      }
    }

    expect(getJourneyStats(ENROLLMENT_ID, new Date(2026, 8, 12, 12))).toMatchObject({
      currentStreak: 1,
      completedDayCount: 1,
    });
  });

  it('has no stats for an unknown enrollment', () => {
    expect(getJourneyStats('nope')).toBeNull();
  });
});
