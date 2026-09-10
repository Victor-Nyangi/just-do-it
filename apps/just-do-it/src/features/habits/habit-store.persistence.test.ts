// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clearPersistedStores } from '../../lib/store-persistence';
import { getInitialHabitCompletions, getInitialHabits } from './habit-data';
import { useHabitStore } from './habit-store';

const STORAGE_KEY = 'just-do-it:habits';

/**
 * Simulate a real page load: storage keeps what the last mutation wrote, memory
 * starts from the fixture seed, then hydration runs.
 *
 * The save/restore is load-bearing. zustand's persist overrides the store's
 * public setState to write through on EVERY call (middleware.js:367-370), so
 * resetting memory would otherwise clobber the very storage we are about to
 * read back. Habits has two slices, so both must be reset together.
 */
async function reload() {
  const saved = localStorage.getItem(STORAGE_KEY);
  useHabitStore.setState({
    habits: getInitialHabits(),
    completions: getInitialHabitCompletions(),
  });
  if (saved === null) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, saved);
  }
  await useHabitStore.persist.rehydrate();
}

describe('habit store persistence', () => {
  beforeEach(() => {
    clearPersistedStores();
    useHabitStore.setState({
      habits: getInitialHabits(),
      completions: getInitialHabitCompletions(),
    });
  });

  afterEach(() => {
    clearPersistedStores();
  });

  it('seeds both slices from the fixtures when storage is empty', async () => {
    // setup.ts's global beforeEach calls setState, and persist writes through on
    // every setState (middleware.js:367-370) -- so the key exists by now. Remove it
    // to actually exercise zustand's "no persisted value" path.
    localStorage.removeItem(STORAGE_KEY);

    await reload();

    expect(useHabitStore.getState().habits).toHaveLength(getInitialHabits().length);
    expect(useHabitStore.getState().completions).toHaveLength(getInitialHabitCompletions().length);
  });

  it('keeps a completion across a reload', async () => {
    const habit = useHabitStore.getState().habits[0];
    useHabitStore.getState().toggleHabitCompletionOn(habit.id, '2026-09-10');
    const expected = useHabitStore.getState().completions.length;

    await reload();

    expect(useHabitStore.getState().completions).toHaveLength(expected);
    expect(
      useHabitStore
        .getState()
        .completions.some((c) => c.habitId === habit.id && c.date === '2026-09-10'),
    ).toBe(true);
  });

  it('keeps a newly created habit across a reload', async () => {
    useHabitStore.getState().addHabit({
      label: 'Persisted habit',
      description: 'written by the persistence test',
      frequency: 'daily',
      target: 1,
    });
    const count = useHabitStore.getState().habits.length;

    await reload();

    expect(useHabitStore.getState().habits).toHaveLength(count);
    expect(useHabitStore.getState().habits.some((h) => h.label === 'Persisted habit')).toBe(true);
  });

  it('leaves both seeded fixtures in place when storage is not valid JSON', async () => {
    localStorage.setItem(STORAGE_KEY, '{ this is not json');

    // A real load starts from the fixtures; rehydration then fails silently.
    // zustand's rehydrate catch path never calls set() (middleware.js:435), so
    // the assertion is that both fixtures SURVIVE and nothing throws.
    await expect(useHabitStore.persist.rehydrate()).resolves.not.toThrow();

    expect(useHabitStore.getState().habits).toHaveLength(getInitialHabits().length);
    expect(useHabitStore.getState().completions).toHaveLength(getInitialHabitCompletions().length);
  });

  it('rejects a persisted habit that fails its schema', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: { habits: [{ id: 'bad' }], completions: getInitialHabitCompletions() },
        version: 1,
      }),
    );

    await reload();

    expect(useHabitStore.getState().habits).toHaveLength(getInitialHabits().length);
    expect(useHabitStore.getState().habits.some((h) => h.id === 'bad')).toBe(false);
  });

  it('falls back when the persisted version is unknown', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { habits: [], completions: [] }, version: 999 }),
    );

    await reload();

    expect(useHabitStore.getState().habits).toHaveLength(getInitialHabits().length);
    expect(useHabitStore.getState().completions).toHaveLength(getInitialHabitCompletions().length);
  });

  it('rejects BOTH slices when only completions fails its schema', async () => {
    // habits here is entirely well-formed; completions contains one element
    // ({ nope: true }) that violates habitCompletionSchema. The merge is
    // all-or-nothing -- completions reference habits by id, so admitting valid
    // habits beside rejected completions (or vice versa) risks orphaned rows.
    // Both slices must fall back to their fixtures, not just completions.
    //
    // The persisted `habits` payload is deliberately NOT content-identical to
    // getInitialHabits(): one habit's `label` carries a sentinel value. If the
    // persisted habits array were byte-for-byte the same as the fixture, a
    // length/content check after reload could not tell "atomic rejection fell
    // back to the fixture" apart from "a non-atomic merge independently admitted
    // this schema-valid habits payload" -- the two paths would look identical.
    // The sentinel assertion below is what actually discriminates: it only
    // passes if the persisted habits payload was rejected wholesale, not
    // admitted on its own merits.
    const sentinelHabits = getInitialHabits();
    sentinelHabits[0] = { ...sentinelHabits[0], label: 'PERSISTED-NOT-FIXTURE' };

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: { habits: sentinelHabits, completions: [{ nope: true }] },
        version: 1,
      }),
    );

    await reload();

    expect(useHabitStore.getState().completions).toHaveLength(getInitialHabitCompletions().length);
    expect(useHabitStore.getState().habits).toHaveLength(getInitialHabits().length);
    expect(
      useHabitStore.getState().habits.some((habit) => habit.label === 'PERSISTED-NOT-FIXTURE'),
    ).toBe(false);
  });
});
