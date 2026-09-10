// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearPersistedStores } from '../../lib/store-persistence';
import { getInitialBooks } from './book-data';
import { useBookStore } from './book-store';

const STORAGE_KEY = 'just-do-it:books';

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
  useBookStore.setState({ books: getInitialBooks() });
  if (saved === null) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, saved);
  }
  await useBookStore.persist.rehydrate();
}

describe('book store persistence', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearPersistedStores();
    useBookStore.setState({ books: getInitialBooks() });
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
    // setState({ books: getInitialBooks() }) -- so toHaveLength(fixture.length)
    // was satisfied by the harness's own setState, regardless of whether
    // rehydrate()/merge did anything at all.
    //
    // To discriminate, put the store into a state the fixture could never
    // produce (zero books), make sure storage is genuinely absent, and
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
    useBookStore.setState({ books: [] }); // distinguishable; write-through fires
    localStorage.removeItem(STORAGE_KEY); // now genuinely absent, not '[]'

    await useBookStore.persist.rehydrate();

    expect(useBookStore.getState().books).toEqual([]);
  });

  it('keeps an updated book status across a reload', async () => {
    const target = useBookStore.getState().books[0];
    useBookStore.getState().updateBookStatus(target.id, 'finished');
    const expected = useBookStore.getState().books.find((b) => b.id === target.id)?.status;

    await reload();

    expect(useBookStore.getState().books.find((b) => b.id === target.id)?.status).toBe(expected);
    expect(expected).toBe('finished');
  });

  it('keeps a newly created book across a reload', async () => {
    useBookStore.getState().createBook({
      title: 'Persisted book',
      author: 'Test Author',
      status: 'reading',
      note: 'written by the persistence test',
    });
    const count = useBookStore.getState().books.length;

    await reload();

    expect(useBookStore.getState().books).toHaveLength(count);
    expect(useBookStore.getState().books.some((b) => b.title === 'Persisted book')).toBe(true);
  });

  it('leaves the seeded fixture in place when storage is not valid JSON', async () => {
    localStorage.setItem(STORAGE_KEY, '{ this is not json');

    // A real load starts from the fixture; rehydration then fails silently.
    // zustand's rehydrate catch path never calls set() (middleware.js:435), so
    // the assertion is that the fixture SURVIVES and nothing throws.
    await expect(useBookStore.persist.rehydrate()).resolves.not.toThrow();

    expect(useBookStore.getState().books).toHaveLength(getInitialBooks().length);
  });

  it('rejects a persisted record that fails its schema, and warns naming the store', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { books: [{ id: 'bad' }] }, version: 1 }),
    );

    await reload();

    expect(useBookStore.getState().books).toHaveLength(getInitialBooks().length);
    expect(useBookStore.getState().books.some((b) => b.id === 'bad')).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('books');
  });

  it('falls back when the persisted version is unknown', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { books: [] }, version: 999 }));

    await reload();

    expect(useBookStore.getState().books).toHaveLength(getInitialBooks().length);
  });
});
