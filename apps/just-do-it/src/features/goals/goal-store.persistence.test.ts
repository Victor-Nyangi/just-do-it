// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clearPersistedStores } from '../../lib/store-persistence';
import { getInitialGoals } from './goal-data';
import { useGoalStore } from './goal-store';

const STORAGE_KEY = 'just-do-it:goals';

/**
 * Simulate a real page load: storage keeps what the last mutation wrote, memory
 * starts from the fixture seed, then hydration runs.
 *
 * The save/restore is load-bearing. zustand's persist overrides the store's
 * public setState to write through on EVERY call (middleware.js:367-370), so
 * resetting memory would otherwise clobber the very storage we are about to
 * read back.
 */
async function reload() {
  const saved = localStorage.getItem(STORAGE_KEY);
  useGoalStore.setState({ goals: getInitialGoals() });
  if (saved === null) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, saved);
  }
  await useGoalStore.persist.rehydrate();
}

describe('goal store persistence', () => {
  beforeEach(() => {
    clearPersistedStores();
    useGoalStore.setState({ goals: getInitialGoals() });
  });

  afterEach(() => {
    clearPersistedStores();
  });

  it('seeds from the fixture when storage is empty', async () => {
    // setup.ts's global beforeEach calls setState, and persist writes through on
    // every setState (middleware.js:367-370) -- so the key exists by now. Remove it
    // to actually exercise zustand's "no persisted value" path.
    localStorage.removeItem(STORAGE_KEY);

    await reload();

    expect(useGoalStore.getState().goals).toHaveLength(getInitialGoals().length);
  });

  it('keeps an updated goal status across a reload', async () => {
    const target = useGoalStore.getState().goals[0];
    useGoalStore.getState().updateGoalStatus(target.id, 'completed');
    const expected = useGoalStore.getState().goals.find((g) => g.id === target.id)?.status;

    await reload();

    expect(useGoalStore.getState().goals.find((g) => g.id === target.id)?.status).toBe(expected);
    expect(expected).toBe('completed');
  });

  it('keeps a newly created goal across a reload', async () => {
    useGoalStore.getState().createGoal({
      title: 'Persisted goal',
      description: 'written by the persistence test',
      period: 'Yearly focus',
      targetDate: '2026-12-31',
      progress: 0,
      status: 'active',
    });
    const count = useGoalStore.getState().goals.length;

    await reload();

    expect(useGoalStore.getState().goals).toHaveLength(count);
    expect(useGoalStore.getState().goals.some((g) => g.title === 'Persisted goal')).toBe(true);
  });

  it('leaves the seeded fixture in place when storage is not valid JSON', async () => {
    localStorage.setItem(STORAGE_KEY, '{ this is not json');

    // A real load starts from the fixture; rehydration then fails silently.
    // zustand's rehydrate catch path never calls set() (middleware.js:435), so
    // the assertion is that the fixture SURVIVES and nothing throws.
    await expect(useGoalStore.persist.rehydrate()).resolves.not.toThrow();

    expect(useGoalStore.getState().goals).toHaveLength(getInitialGoals().length);
  });

  it('rejects a persisted record that fails its schema', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { goals: [{ id: 'bad' }] }, version: 1 }),
    );

    await reload();

    expect(useGoalStore.getState().goals).toHaveLength(getInitialGoals().length);
    expect(useGoalStore.getState().goals.some((g) => g.id === 'bad')).toBe(false);
  });

  it('falls back when the persisted version is unknown', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { goals: [] }, version: 999 }));

    await reload();

    expect(useGoalStore.getState().goals).toHaveLength(getInitialGoals().length);
  });
});
