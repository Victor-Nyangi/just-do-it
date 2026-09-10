// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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
  beforeEach(() => {
    clearPersistedStores();
    useBookStore.setState({ books: getInitialBooks() });
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

    expect(useBookStore.getState().books).toHaveLength(getInitialBooks().length);
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

  it('rejects a persisted record that fails its schema', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { books: [{ id: 'bad' }] }, version: 1 }),
    );

    await reload();

    expect(useBookStore.getState().books).toHaveLength(getInitialBooks().length);
    expect(useBookStore.getState().books.some((b) => b.id === 'bad')).toBe(false);
  });

  it('falls back when the persisted version is unknown', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { books: [] }, version: 999 }));

    await reload();

    expect(useBookStore.getState().books).toHaveLength(getInitialBooks().length);
  });
});
