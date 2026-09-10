// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clearPersistedStores } from '../../lib/store-persistence';
import { getInitialLists } from './list-data';
import { useListStore } from './list-store';

const STORAGE_KEY = 'just-do-it:lists';

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
  useListStore.setState({ lists: getInitialLists() });
  if (saved === null) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, saved);
  }
  await useListStore.persist.rehydrate();
}

describe('list store persistence', () => {
  beforeEach(() => {
    clearPersistedStores();
    useListStore.setState({ lists: getInitialLists() });
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

    expect(useListStore.getState().lists).toHaveLength(getInitialLists().length);
  });

  it('keeps a toggled list item across a reload', async () => {
    const targetList = useListStore.getState().lists[0];
    const targetItem = targetList.items[0];
    useListStore.getState().toggleListItem(targetList.id, targetItem.id);
    const expected = useListStore
      .getState()
      .lists.find((l) => l.id === targetList.id)
      ?.items.find((i) => i.id === targetItem.id)?.complete;

    await reload();

    expect(
      useListStore
        .getState()
        .lists.find((l) => l.id === targetList.id)
        ?.items.find((i) => i.id === targetItem.id)?.complete,
    ).toBe(expected);
    expect(expected).toBe(true);
  });

  it('keeps a newly created list across a reload', async () => {
    useListStore.getState().createList({ name: 'Persisted list', note: 'from the test' });
    const count = useListStore.getState().lists.length;

    await reload();

    expect(useListStore.getState().lists).toHaveLength(count);
    expect(useListStore.getState().lists.some((l) => l.name === 'Persisted list')).toBe(true);
  });

  it('leaves the seeded fixture in place when storage is not valid JSON', async () => {
    localStorage.setItem(STORAGE_KEY, '{ this is not json');

    // A real load starts from the fixture; rehydration then fails silently.
    // zustand's rehydrate catch path never calls set() (middleware.js:435), so
    // the assertion is that the fixture SURVIVES and nothing throws.
    await expect(useListStore.persist.rehydrate()).resolves.not.toThrow();

    expect(useListStore.getState().lists).toHaveLength(getInitialLists().length);
  });

  it('rejects a persisted list that fails its schema', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { lists: [{ id: 'bad', items: 'not-an-array' }] }, version: 1 }),
    );

    await reload();

    expect(useListStore.getState().lists).toHaveLength(getInitialLists().length);
    expect(useListStore.getState().lists.some((l) => l.id === 'bad')).toBe(false);
  });

  it('rejects a persisted list whose items array contains a malformed item', async () => {
    // The `items` array itself is well-formed (a real array of two well-shaped
    // objects) -- unlike the `items: 'not-an-array'` case above, which fails on
    // the field's own type. Here the second element's `complete` is a string
    // ('yes') instead of a boolean, violating listItemSchema's
    // `complete: z.boolean()` (list-data.ts). zod's recursive parse must reject
    // the whole list -- and therefore the whole persisted collection -- because
    // one array element fails its element schema, not because the array's shape
    // is wrong.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          lists: [
            {
              id: 'list-with-bad-item',
              name: 'Otherwise valid list',
              items: [
                { id: 'ok-item', title: 'Fine item', complete: false },
                { id: 'bad-item', title: 'Bad item', complete: 'yes' },
              ],
            },
          ],
        },
        version: 1,
      }),
    );

    await reload();

    expect(useListStore.getState().lists).toHaveLength(getInitialLists().length);
    expect(useListStore.getState().lists.some((l) => l.id === 'list-with-bad-item')).toBe(false);
  });

  it('falls back when the persisted version is unknown', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { lists: [] }, version: 999 }));

    await reload();

    expect(useListStore.getState().lists).toHaveLength(getInitialLists().length);
  });
});
