// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearPersistedStores } from '../../lib/store-persistence';
import { getInitialTasks } from './task-data';
import { useTaskStore } from './task-store';

const STORAGE_KEY = 'just-do-it:tasks';

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
  useTaskStore.setState({ tasks: getInitialTasks() });
  if (saved === null) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, saved);
  }
  await useTaskStore.persist.rehydrate();
}

describe('task store persistence', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearPersistedStores();
    useTaskStore.setState({ tasks: getInitialTasks() });
    // createValidatedMerge's fallback now warns (store-persistence.ts). Several
    // tests below deliberately feed corrupt/mismatched data to exercise that
    // fallback; silence the console here by default so the suite stays quiet,
    // and assert on the spy explicitly in the one test where the warn is the
    // point.
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    clearPersistedStores();
    warnSpy.mockRestore();
  });

  it('does not clobber in-memory state with the fixture when storage is empty', async () => {
    // The old version of this test called reload(), which itself begins with
    // setState({ tasks: getInitialTasks() }) -- so toHaveLength(fixture.length)
    // was satisfied by the harness's own setState, regardless of whether
    // rehydrate()/merge did anything at all.
    //
    // To discriminate, put the store into a state the fixture could never
    // produce (zero tasks), make sure storage is genuinely absent, and
    // rehydrate directly (not via reload(), which would immediately re-seed
    // the fixture and defeat the point).
    //
    // The assertion is that state STAYS at zero, not that the fixture
    // reappears: createValidatedMerge's fallback returns `current` verbatim
    // (see store-persistence.ts), and it has no notion of "the fixture" at
    // all -- current only happens to BE the fixture in production because
    // create() seeds it that way and nothing touches it before the first
    // rehydrate. So the real, verifiable invariant at this layer is "an
    // absent persisted value must not overwrite whatever is already there."
    useTaskStore.setState({ tasks: [] }); // distinguishable; write-through fires
    localStorage.removeItem(STORAGE_KEY); // now genuinely absent, not '[]'

    await useTaskStore.persist.rehydrate();

    expect(useTaskStore.getState().tasks).toEqual([]);
  });

  it('keeps a completed task across a reload', async () => {
    const target = useTaskStore.getState().tasks[0];
    useTaskStore.getState().toggleTaskCompletion(target.id);
    const expected = useTaskStore.getState().tasks.find((t) => t.id === target.id)?.status;

    await reload();

    expect(useTaskStore.getState().tasks.find((t) => t.id === target.id)?.status).toBe(expected);
    expect(expected).toBe('completed');
  });

  it('keeps a newly created task across a reload', async () => {
    useTaskStore.getState().createTask({
      title: 'Persisted task',
      description: 'written by the persistence test',
      status: 'todo',
      priority: 'medium',
      category: 'Personal',
      dueDate: undefined,
      recurrence: 'none',
      recurrenceInterval: 1,
    });
    const count = useTaskStore.getState().tasks.length;

    await reload();

    expect(useTaskStore.getState().tasks).toHaveLength(count);
    expect(useTaskStore.getState().tasks.some((t) => t.title === 'Persisted task')).toBe(true);
  });

  it('leaves the seeded fixture in place when storage is not valid JSON', async () => {
    localStorage.setItem(STORAGE_KEY, '{ this is not json');

    // A real load starts from the fixture; rehydration then fails silently.
    // zustand's rehydrate catch path never calls set() (middleware.js:435), so
    // the assertion is that the fixture SURVIVES and nothing throws.
    await expect(useTaskStore.persist.rehydrate()).resolves.not.toThrow();

    expect(useTaskStore.getState().tasks).toHaveLength(getInitialTasks().length);
  });

  it('rejects a persisted record that fails its schema, and warns naming the store', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { tasks: [{ id: 'x', title: '' }] }, version: 1 }),
    );

    await reload();

    expect(useTaskStore.getState().tasks).toHaveLength(getInitialTasks().length);
    expect(useTaskStore.getState().tasks.some((t) => t.id === 'x')).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('tasks');
  });

  it('falls back when the persisted version is unknown', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { tasks: [] }, version: 999 }));

    await reload();

    expect(useTaskStore.getState().tasks).toHaveLength(getInitialTasks().length);
  });
});
