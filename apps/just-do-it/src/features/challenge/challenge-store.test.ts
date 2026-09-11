import { beforeEach, describe, expect, it } from 'vitest';

import {
  getInitialChallenge,
  getInitialChallengeBooks,
  getInitialChallengeCompletions,
} from './challenge-data';
import { useChallengeStore } from './challenge-store';

// The pure-logic suites run under node, where src/test/setup.ts does no store
// reset — that is gated behind a document. This store is a module singleton, so
// the reset has to happen here.
beforeEach(() => {
  useChallengeStore.setState({
    challenge: getInitialChallenge(),
    books: getInitialChallengeBooks(),
    completions: getInitialChallengeCompletions(),
  });
});

function completionIds(): string[] {
  return useChallengeStore.getState().completions.map((completion) => completion.activityId);
}

describe('the challenge store', () => {
  it('seeds itself from the fixtures', () => {
    const state = useChallengeStore.getState();

    expect(state.challenge.totalDays).toBe(100);
    expect(state.books).toHaveLength(19);
    expect(completionIds()).toEqual(['day-1-walk-1km', 'day-1-technical-reading']);
  });
});

describe('toggleActivityCompletion', () => {
  it('ticks an activity that was not done', () => {
    useChallengeStore.getState().toggleActivityCompletion(1, 'day-1-reflection');

    expect(completionIds()).toContain('day-1-reflection');
  });

  it('unticks one that was', () => {
    useChallengeStore.getState().toggleActivityCompletion(1, 'day-1-walk-1km');

    expect(completionIds()).not.toContain('day-1-walk-1km');
  });

  it('leaves the other completions alone', () => {
    useChallengeStore.getState().toggleActivityCompletion(1, 'day-1-walk-1km');

    expect(completionIds()).toEqual(['day-1-technical-reading']);
  });

  it('records when the activity was finished', () => {
    const completedAt = new Date(2026, 8, 11, 18, 30);

    useChallengeStore.getState().toggleActivityCompletion(1, 'day-1-reflection', completedAt);

    const written = useChallengeStore
      .getState()
      .completions.find((completion) => completion.activityId === 'day-1-reflection');

    expect(written?.completedAt).toBe(completedAt.toISOString());
    expect(written?.dayIndex).toBe(1);
  });

  // The plan is generated rather than stored, so the store is the only place
  // that can tell a real activity id from a stale or invented one.
  it('refuses an activity that the day does not offer', () => {
    const before = completionIds();

    useChallengeStore.getState().toggleActivityCompletion(1, 'day-1-swim-2km');

    expect(completionIds()).toEqual(before);
  });

  it('refuses an activity attributed to the wrong day', () => {
    const before = completionIds();

    // A real activity id, but day 2's plan does not contain it.
    useChallengeStore.getState().toggleActivityCompletion(2, 'day-1-reflection');

    expect(completionIds()).toEqual(before);
  });

  it('refuses a day outside the challenge window', () => {
    const before = completionIds();

    useChallengeStore.getState().toggleActivityCompletion(101, 'day-101-reflection');

    expect(completionIds()).toEqual(before);
  });

  it('survives a round trip back to where it started', () => {
    const before = completionIds();

    useChallengeStore.getState().toggleActivityCompletion(1, 'day-1-reflection');
    useChallengeStore.getState().toggleActivityCompletion(1, 'day-1-reflection');

    expect(completionIds()).toEqual(before);
  });

  // Every mutation re-parses through the schema, so an invalid record cannot be
  // written by feature code either. A duplicate is the failure the toggle path
  // could plausibly produce, and it must not reach the array.
  it('never writes the same activity twice', () => {
    useChallengeStore.getState().toggleActivityCompletion(1, 'day-1-reflection');
    useChallengeStore.getState().toggleActivityCompletion(1, 'day-1-reflection');
    useChallengeStore.getState().toggleActivityCompletion(1, 'day-1-reflection');

    expect(completionIds().filter((id) => id === 'day-1-reflection')).toHaveLength(1);
  });
});
