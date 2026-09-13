// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getInitialJourneyCompletions,
  getInitialJourneyEnrollments,
  getInitialJourneys,
} from './journey-data';
import {
  buildInitialJourneyState,
  clearPersistedJourneyState,
  loadPersistedJourneyState,
  savePersistedJourneyState,
} from './journey-persistence';
import { EXAMPLE_JOURNEY_COMPLETIONS, seedJourneyStore } from '../../test/journey-baseline';
import { useJourneyStore } from './journey-store';

const STORAGE_KEY = 'just-do-it:journeys:v1';

function writeRaw(value: string) {
  localStorage.setItem(STORAGE_KEY, value);
}

function baseState() {
  return {
    journeys: getInitialJourneys(),
    enrollments: getInitialJourneyEnrollments(),
    completions: getInitialJourneyCompletions(),
  };
}

beforeEach(() => {
  clearPersistedJourneyState();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('saving', () => {
  it('round-trips enrollments and completions', () => {
    savePersistedJourneyState(baseState());

    const loaded = loadPersistedJourneyState();

    expect(loaded?.enrollments).toEqual(getInitialJourneyEnrollments());
    expect(loaded?.completions).toEqual(getInitialJourneyCompletions());
  });

  // Journey definitions belong to the repo. Storing a copy would freeze
  // whatever shape a journey had the day the browser first saw it, so a commit
  // editing `journeys.json` would never reach a returning visitor.
  it('does not store the journeys that ship in the repo', () => {
    savePersistedJourneyState(baseState());

    expect(loadPersistedJourneyState()?.journeys).toEqual([]);
  });

  it('does store a journey the user created', () => {
    const custom = { ...getInitialJourneys()[0], id: 'custom-1', title: 'Mine' };

    savePersistedJourneyState({ ...baseState(), journeys: [...getInitialJourneys(), custom] });

    expect(loadPersistedJourneyState()?.journeys.map((journey) => journey.id)).toEqual([
      'custom-1',
    ]);
  });
});

describe('loading', () => {
  it('reads nothing when the browser has never stored anything', () => {
    expect(loadPersistedJourneyState()).toBeNull();
  });

  // Stored state is untrusted: it was written by an older build, or edited by
  // hand in devtools. None of these may take the app down at boot.
  it('discards a value that is not JSON', () => {
    writeRaw('{definitely not json');

    expect(loadPersistedJourneyState()).toBeNull();
  });

  it('discards JSON of the wrong shape', () => {
    writeRaw('"a string"');

    expect(loadPersistedJourneyState()).toBeNull();
  });

  it('discards state that fails the schemas', () => {
    writeRaw(JSON.stringify({ journeys: [], enrollments: [{ id: 'x' }], completions: [] }));

    expect(loadPersistedJourneyState()).toBeNull();
  });

  it('accepts state with the keys missing entirely', () => {
    writeRaw('{}');

    expect(loadPersistedJourneyState()).toEqual({
      journeys: [],
      enrollments: [],
      completions: [],
    });
  });

  // A private window, or blocked site data, throws on access rather than
  // returning null.
  it('survives localStorage throwing outright', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(loadPersistedJourneyState()).toBeNull();
  });

  it('survives a write failing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => savePersistedJourneyState(baseState())).not.toThrow();
  });
});

describe('buildInitialJourneyState', () => {
  it('falls back to the committed fixtures on a first visit', () => {
    const state = buildInitialJourneyState();

    expect(state.journeys).toEqual(getInitialJourneys());
    expect(state.enrollments).toEqual(getInitialJourneyEnrollments());
    expect(state.completions).toEqual(getInitialJourneyCompletions());
  });

  it('prefers stored completions over the committed ones', () => {
    savePersistedJourneyState({ ...baseState(), completions: [] });

    expect(buildInitialJourneyState().completions).toEqual([]);
  });

  // The presence of stored state decides this, not whether it is empty:
  // someone who left every journey must stay left rather than have the seeded
  // enrollment reappear on the next reload.
  it('keeps a journey left rather than re-seeding it', () => {
    savePersistedJourneyState({ ...baseState(), enrollments: [], completions: [] });

    expect(buildInitialJourneyState().enrollments).toEqual([]);
  });

  // The point of not persisting fixture journeys: a commit that edits one has
  // to reach a browser that already has state.
  it('takes journey definitions from the repo even when state is stored', () => {
    savePersistedJourneyState(baseState());

    expect(buildInitialJourneyState().journeys).toEqual(getInitialJourneys());
  });

  it('keeps a user-created journey alongside the repo ones', () => {
    const custom = { ...getInitialJourneys()[0], id: 'custom-1', title: 'Mine' };

    savePersistedJourneyState({ ...baseState(), journeys: [...getInitialJourneys(), custom] });

    const state = buildInitialJourneyState();

    expect(state.journeys).toHaveLength(getInitialJourneys().length + 1);
    expect(state.journeys.at(-1)?.id).toBe('custom-1');
  });

  it('goes back to the committed state once storage is cleared', () => {
    savePersistedJourneyState({ ...baseState(), completions: [] });
    clearPersistedJourneyState();

    expect(buildInitialJourneyState().completions).toEqual(getInitialJourneyCompletions());
  });
});

// The store subscribes to itself and writes on every mutation, which is the
// half that actually makes a tick survive a reload. These drive it rather than
// the persistence functions directly.
describe('the store writing through to storage', () => {
  beforeEach(() => {
    clearPersistedJourneyState();
    seedJourneyStore();
  });

  it('persists a tick', () => {
    useJourneyStore
      .getState()
      .toggleActivityCompletion('enrollment-discipline', 1, 'day-1-reflection');

    expect(
      loadPersistedJourneyState()?.completions.map((completion) => completion.activityId),
    ).toContain('day-1-reflection');
  });

  it('persists an untick as an absence', () => {
    const [seeded] = EXAMPLE_JOURNEY_COMPLETIONS;

    useJourneyStore
      .getState()
      .toggleActivityCompletion('enrollment-discipline', 1, seeded.activityId);

    expect(
      loadPersistedJourneyState()?.completions.map((completion) => completion.activityId),
    ).not.toContain(seeded.activityId);
  });

  it('persists leaving a journey', () => {
    useJourneyStore.getState().leaveJourney('enrollment-discipline');

    expect(loadPersistedJourneyState()?.enrollments).toEqual([]);
  });

  it('rebuilds the stored state on the next boot', () => {
    useJourneyStore
      .getState()
      .toggleActivityCompletion('enrollment-discipline', 1, 'day-1-reflection');

    expect(
      buildInitialJourneyState().completions.map((completion) => completion.activityId),
    ).toContain('day-1-reflection');
  });

  it('throws the local record away on reset', () => {
    useJourneyStore
      .getState()
      .toggleActivityCompletion('enrollment-discipline', 1, 'day-1-reflection');

    useJourneyStore.getState().resetToCommittedState();

    expect(useJourneyStore.getState().completions).toEqual(getInitialJourneyCompletions());
    expect(loadPersistedJourneyState()?.completions ?? null).toEqual(
      getInitialJourneyCompletions(),
    );
  });

  it('puts a left journey back on reset', () => {
    useJourneyStore.getState().leaveJourney('enrollment-discipline');
    useJourneyStore.getState().resetToCommittedState();

    expect(useJourneyStore.getState().enrollments).toEqual(getInitialJourneyEnrollments());
  });
});
