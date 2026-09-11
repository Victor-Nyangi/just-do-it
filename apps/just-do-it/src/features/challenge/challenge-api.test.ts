import { beforeEach, describe, expect, it } from 'vitest';

import { completeChallengeActivity, getChallengeDay, getChallengeStats } from './challenge-api';
import {
  getInitialChallenge,
  getInitialChallengeBooks,
  getInitialChallengeCompletions,
} from './challenge-data';
import { useChallengeStore } from './challenge-store';

// These three functions are the in-process stand-ins for the specified
// endpoints, so this file is the closest thing the POC has to endpoint tests:
// it pins the contracts a real GET/POST would have to keep.
beforeEach(() => {
  useChallengeStore.setState({
    challenge: getInitialChallenge(),
    books: getInitialChallengeBooks(),
    completions: getInitialChallengeCompletions(),
  });
});

describe('getChallengeDay — GET /api/challenge/day/[dayIndex]', () => {
  it('returns the day plan alongside its completion state', () => {
    const response = getChallengeDay(1);

    expect(response).toMatchObject({
      dayIndex: 1,
      date: '2026-09-11',
      completedCount: 2,
      activityCount: 5,
      complete: false,
    });
    expect(response?.plan.activities).toHaveLength(5);
  });

  it('lists the completed ids in plan order rather than tick order', () => {
    completeChallengeActivity(1, 'day-1-reflection');

    expect(getChallengeDay(1)?.completedActivityIds).toEqual([
      'day-1-walk-1km',
      'day-1-technical-reading',
      'day-1-reflection',
    ]);
  });

  it('reports an untouched day as untouched', () => {
    expect(getChallengeDay(2)).toMatchObject({ completedCount: 0, complete: false });
  });

  // Null is this layer's 404.
  it('has no day outside the hundred', () => {
    expect(getChallengeDay(0)).toBeNull();
    expect(getChallengeDay(101)).toBeNull();
  });
});

describe('completeChallengeActivity — POST /api/challenge/day/[dayIndex]/complete', () => {
  it('toggles an activity on and returns the day as it now stands', () => {
    const response = completeChallengeActivity(1, 'day-1-reflection');

    expect(response).toMatchObject({ dayIndex: 1, completedCount: 3 });
    expect(response?.completedActivityIds).toContain('day-1-reflection');
  });

  it('toggles the same activity back off', () => {
    completeChallengeActivity(1, 'day-1-reflection');

    expect(completeChallengeActivity(1, 'day-1-reflection')?.completedCount).toBe(2);
  });

  it('reports the day complete once nothing is left', () => {
    for (const activityId of ['day-1-push-ups-50', 'day-1-growth-reading', 'day-1-reflection']) {
      completeChallengeActivity(1, activityId);
    }

    expect(getChallengeDay(1)).toMatchObject({ completedCount: 5, complete: true });
  });

  it('leaves the day untouched when the activity is not one of its own', () => {
    const response = completeChallengeActivity(1, 'day-1-swim-2km');

    expect(response?.completedCount).toBe(2);
    expect(useChallengeStore.getState().completions).toHaveLength(2);
  });

  it('has no day to post to outside the hundred', () => {
    expect(completeChallengeActivity(101, 'day-101-reflection')).toBeNull();
  });
});

describe('getChallengeStats — GET /api/challenge/stats', () => {
  it('returns the streak, the total done, and the activity count', () => {
    const stats = getChallengeStats(new Date(2026, 8, 11, 12));

    expect(stats).toMatchObject({
      currentDayIndex: 1,
      currentStreak: 0,
      completedActivityCount: 2,
      totalActivityCount: 486,
    });
  });

  it('moves once an activity is completed through the API', () => {
    completeChallengeActivity(2, 'day-2-reflection');

    expect(getChallengeStats(new Date(2026, 8, 12, 12)).completedActivityCount).toBe(3);
  });

  it('counts a streak built through the API', () => {
    const dayOne = getChallengeDay(1);

    for (const activity of dayOne?.plan.activities ?? []) {
      if (!dayOne?.completedActivityIds.includes(activity.id)) {
        completeChallengeActivity(1, activity.id);
      }
    }

    expect(getChallengeStats(new Date(2026, 8, 11, 12))).toMatchObject({
      currentStreak: 1,
      completedDayCount: 1,
    });
  });
});
