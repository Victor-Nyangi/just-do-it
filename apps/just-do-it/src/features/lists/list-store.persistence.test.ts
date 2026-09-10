// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearPersistedStores();
    useListStore.setState({ lists: getInitialLists() });
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
    // setState({ lists: getInitialLists() }) -- so toHaveLength(fixture.length)
    // was satisfied by the harness's own setState, regardless of whether
    // rehydrate()/merge did anything at all.
    //
    // To discriminate, put the store into a state the fixture could never
    // produce (zero lists), make sure storage is genuinely absent, and
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
    useListStore.setState({ lists: [] }); // distinguishable; write-through fires
    localStorage.removeItem(STORAGE_KEY); // now genuinely absent, not '[]'

    await useListStore.persist.rehydrate();

    expect(useListStore.getState().lists).toEqual([]);
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

  it('rejects a persisted list that fails its schema, and warns naming the store', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { lists: [{ id: 'bad', items: 'not-an-array' }] }, version: 1 }),
    );

    await reload();

    expect(useListStore.getState().lists).toHaveLength(getInitialLists().length);
    expect(useListStore.getState().lists.some((l) => l.id === 'bad')).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('lists');
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
