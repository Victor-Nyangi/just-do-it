// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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
  beforeEach(() => {
    clearPersistedStores();
    useTaskStore.setState({ tasks: getInitialTasks() });
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

    expect(useTaskStore.getState().tasks).toHaveLength(getInitialTasks().length);
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

  it('rejects a persisted record that fails its schema', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { tasks: [{ id: 'x', title: '' }] }, version: 1 }),
    );

    await reload();

    expect(useTaskStore.getState().tasks).toHaveLength(getInitialTasks().length);
    expect(useTaskStore.getState().tasks.some((t) => t.id === 'x')).toBe(false);
  });

  it('falls back when the persisted version is unknown', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { tasks: [] }, version: 999 }));

    await reload();

    expect(useTaskStore.getState().tasks).toHaveLength(getInitialTasks().length);
  });
});
