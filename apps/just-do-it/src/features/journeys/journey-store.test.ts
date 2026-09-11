import { beforeEach, describe, expect, it } from 'vitest';

import {
  getInitialJourneyCompletions,
  getInitialJourneyEnrollments,
  getInitialJourneys,
} from './journey-data';
import { useJourneyStore } from './journey-store';

const ENROLLMENT_ID = 'enrollment-discipline';

// The pure-logic suites run under node, where src/test/setup.ts does no store
// reset — that is gated behind a document. This store is a module singleton, so
// the reset has to happen here.
beforeEach(() => {
  useJourneyStore.setState({
    journeys: getInitialJourneys(),
    enrollments: getInitialJourneyEnrollments(),
    completions: getInitialJourneyCompletions(),
  });
});

function completionIds(): string[] {
  return useJourneyStore.getState().completions.map((completion) => completion.activityId);
}

describe('the journey store', () => {
  it('seeds itself from the fixtures', () => {
    const state = useJourneyStore.getState();

    expect(state.journeys).toHaveLength(2);
    expect(state.enrollments).toHaveLength(1);
    expect(completionIds()).toEqual(['day-1-walk-1km', 'day-1-technical-reading']);
  });
});

describe('toggleActivityCompletion', () => {
  it('ticks an activity that was not done', () => {
    useJourneyStore.getState().toggleActivityCompletion(ENROLLMENT_ID, 1, 'day-1-reflection');

    expect(completionIds()).toContain('day-1-reflection');
  });

  it('unticks one that was', () => {
    useJourneyStore.getState().toggleActivityCompletion(ENROLLMENT_ID, 1, 'day-1-walk-1km');

    expect(completionIds()).toEqual(['day-1-technical-reading']);
  });

  it('records when the activity was finished, against its enrollment', () => {
    const completedAt = new Date(2026, 8, 11, 18, 30);

    useJourneyStore
      .getState()
      .toggleActivityCompletion(ENROLLMENT_ID, 1, 'day-1-reflection', completedAt);

    expect(
      useJourneyStore
        .getState()
        .completions.find((completion) => completion.activityId === 'day-1-reflection'),
    ).toMatchObject({
      enrollmentId: ENROLLMENT_ID,
      dayIndex: 1,
      completedAt: completedAt.toISOString(),
    });
  });

  // The plan is generated rather than stored, so the store is the only place
  // that can tell a real activity id from a stale or invented one.
  it('refuses an activity that the day does not offer', () => {
    const before = completionIds();

    useJourneyStore.getState().toggleActivityCompletion(ENROLLMENT_ID, 1, 'day-1-swim-2km');

    expect(completionIds()).toEqual(before);
  });

  it('refuses an activity attributed to the wrong day', () => {
    const before = completionIds();

    useJourneyStore.getState().toggleActivityCompletion(ENROLLMENT_ID, 2, 'day-1-reflection');

    expect(completionIds()).toEqual(before);
  });

  it('refuses a day outside the journey window', () => {
    const before = completionIds();

    useJourneyStore.getState().toggleActivityCompletion(ENROLLMENT_ID, 101, 'day-101-reflection');

    expect(completionIds()).toEqual(before);
  });

  it('refuses an enrollment that does not exist', () => {
    const before = completionIds();

    useJourneyStore.getState().toggleActivityCompletion('nope', 1, 'day-1-reflection');

    expect(completionIds()).toEqual(before);
  });

  it('survives a round trip back to where it started', () => {
    const before = completionIds();

    useJourneyStore.getState().toggleActivityCompletion(ENROLLMENT_ID, 1, 'day-1-reflection');
    useJourneyStore.getState().toggleActivityCompletion(ENROLLMENT_ID, 1, 'day-1-reflection');

    expect(completionIds()).toEqual(before);
  });

  it('never writes the same activity twice', () => {
    for (let index = 0; index < 3; index += 1) {
      useJourneyStore.getState().toggleActivityCompletion(ENROLLMENT_ID, 1, 'day-1-reflection');
    }

    expect(completionIds().filter((id) => id === 'day-1-reflection')).toHaveLength(1);
  });

  // Two enrollments of the same journey share activity ids, so ticking one must
  // not tick the other.
  it('keeps two enrollments of the same journey independent', () => {
    const secondId = useJourneyStore
      .getState()
      .enrollInJourney('hundred-day-discipline', '2027-01-01');

    if (!secondId) throw new Error('Expected the second enrollment to be created');

    useJourneyStore.getState().toggleActivityCompletion(secondId, 1, 'day-1-reflection');

    const completions = useJourneyStore.getState().completions;

    expect(completions.filter((entry) => entry.activityId === 'day-1-reflection')).toHaveLength(1);
    expect(completions.find((entry) => entry.activityId === 'day-1-reflection')?.enrollmentId).toBe(
      secondId,
    );
  });
});

describe('enrollInJourney', () => {
  it('starts a journey on the chosen date', () => {
    const enrollmentId = useJourneyStore
      .getState()
      .enrollInJourney('deep-work-reset', '2026-10-01');
    const enrollment = useJourneyStore
      .getState()
      .enrollments.find((entry) => entry.id === enrollmentId);

    expect(enrollment).toMatchObject({ journeyId: 'deep-work-reset', startDate: '2026-10-01' });
  });

  it('refuses a journey that does not exist', () => {
    expect(useJourneyStore.getState().enrollInJourney('nope', '2026-10-01')).toBeNull();
    expect(useJourneyStore.getState().enrollments).toHaveLength(1);
  });

  it('refuses a start date that is not a calendar date', () => {
    expect(() =>
      useJourneyStore.getState().enrollInJourney('deep-work-reset', 'next tuesday'),
    ).toThrow();
  });
});

describe('leaveJourney', () => {
  // Completions belong to the enrollment, so leaving takes its history with it
  // rather than stranding orphan rows.
  it('takes the enrollment and its completions together', () => {
    useJourneyStore.getState().leaveJourney(ENROLLMENT_ID);

    expect(useJourneyStore.getState().enrollments).toHaveLength(0);
    expect(useJourneyStore.getState().completions).toHaveLength(0);
  });

  it('leaves other enrollments untouched', () => {
    const secondId = useJourneyStore.getState().enrollInJourney('deep-work-reset', '2026-10-01');

    useJourneyStore.getState().leaveJourney(ENROLLMENT_ID);

    expect(useJourneyStore.getState().enrollments.map((entry) => entry.id)).toEqual([secondId]);
  });
});

describe('createJourney', () => {
  it('adds a journey that can then be started', () => {
    const journeyId = useJourneyStore
      .getState()
      .createJourney({ title: 'My journey', description: 'Mine', totalDays: 21 });

    expect(useJourneyStore.getState().journeys).toHaveLength(3);
    expect(useJourneyStore.getState().enrollInJourney(journeyId, '2026-10-01')).not.toBeNull();
  });

  it('defaults a new journey to a reflection so that it schedules something', () => {
    const journeyId = useJourneyStore
      .getState()
      .createJourney({ title: 'My journey', description: 'Mine', totalDays: 21 });
    const journey = useJourneyStore.getState().journeys.find((entry) => entry.id === journeyId);

    expect(journey).toMatchObject({ totalDays: 21, reflectionLineCount: 3, books: [] });
  });

  // Every mutation re-parses through the schema, so feature code cannot write
  // an invalid journey either.
  it('refuses a journey that would schedule nothing', () => {
    expect(() =>
      useJourneyStore.getState().createJourney({
        title: 'Empty',
        description: '',
        totalDays: 10,
        reflectionLineCount: 0,
      }),
    ).toThrow();
  });

  it('refuses a blank title', () => {
    expect(() =>
      useJourneyStore.getState().createJourney({ title: '  ', description: '', totalDays: 10 }),
    ).toThrow();
  });
});
