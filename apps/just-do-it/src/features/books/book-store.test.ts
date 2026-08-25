import { beforeEach, describe, expect, it } from 'vitest';

import { getInitialBooks } from './book-data';
import { useBookStore } from './book-store';
import type { Book, BookInput } from './types';

const baseInput: BookInput = {
  title: 'The Pragmatic Programmer',
  author: 'Hunt and Thomas',
  status: 'reading',
};

function createBook(overrides: Partial<BookInput> = {}): Book {
  useBookStore.getState().createBook({ ...baseInput, ...overrides });

  const created = useBookStore.getState().books.at(-1);
  if (!created) throw new Error('createBook did not append a book');

  return created;
}

function findBook(bookId: string) {
  return useBookStore.getState().books.find((book) => book.id === bookId);
}

describe('useBookStore — createBook', () => {
  beforeEach(() => {
    useBookStore.setState({ books: getInitialBooks() });
  });

  it('appends the new book without disturbing the existing ones', () => {
    const before = useBookStore.getState().books.length;

    const created = createBook({ title: 'Shantaram' });

    expect(useBookStore.getState().books).toHaveLength(before + 1);
    expect(created.title).toBe('Shantaram');
  });

  it('leaves an omitted note and rating undefined', () => {
    const created = createBook();

    expect(created.note).toBeUndefined();
    expect(created.rating).toBeUndefined();
  });

  it('treats a whitespace-only note as no note at all', () => {
    expect(createBook({ note: '   ' }).note).toBeUndefined();
  });

  it('trims a note down to its content', () => {
    expect(createBook({ note: '  Worth a reread  ' }).note).toBe('Worth a reread');
  });

  it('gives each book a distinct id', () => {
    expect(createBook().id).not.toBe(createBook().id);
  });
});

describe('useBookStore — rating normalization', () => {
  beforeEach(() => {
    useBookStore.setState({ books: getInitialBooks() });
  });

  it('rounds a fractional rating', () => {
    expect(createBook({ rating: 3.6 }).rating).toBe(4);
  });

  it('clamps a rating below one', () => {
    expect(createBook({ rating: 0 }).rating).toBe(1);
  });

  it('clamps a rating above five', () => {
    expect(createBook({ rating: 9 }).rating).toBe(5);
  });

  it('normalizes a rating supplied through updateBookRating', () => {
    const book = createBook();

    useBookStore.getState().updateBookRating(book.id, 7);

    expect(findBook(book.id)?.rating).toBe(5);
  });
});

describe('useBookStore — clearing an optional field', () => {
  beforeEach(() => {
    useBookStore.setState({ books: getInitialBooks() });
  });

  it('clears the note when an explicit undefined is passed', () => {
    const book = createBook({ note: 'Worth a reread' });

    useBookStore.getState().updateBookNote(book.id, undefined);

    expect(findBook(book.id)?.note).toBeUndefined();
  });

  it('clears the note when the field is blanked to whitespace', () => {
    const book = createBook({ note: 'Worth a reread' });

    useBookStore.getState().updateBookNote(book.id, '   ');

    expect(findBook(book.id)?.note).toBeUndefined();
  });

  it('clears the rating when an explicit undefined is passed', () => {
    const book = createBook({ rating: 4 });

    useBookStore.getState().updateBookRating(book.id, undefined);

    expect(findBook(book.id)?.rating).toBeUndefined();
  });

  it('keeps the note when the key is absent from a partial update', () => {
    const book = createBook({ note: 'Worth a reread', rating: 4 });

    useBookStore.getState().updateBook(book.id, { title: 'The Pragmatic Programmer, 2nd ed.' });

    const updated = findBook(book.id);
    expect(updated?.note).toBe('Worth a reread');
    expect(updated?.rating).toBe(4);
    expect(updated?.title).toBe('The Pragmatic Programmer, 2nd ed.');
  });

  it('keeps the rating when only the status changes', () => {
    const book = createBook({ rating: 4 });

    useBookStore.getState().updateBookStatus(book.id, 'finished');

    const updated = findBook(book.id);
    expect(updated?.status).toBe('finished');
    expect(updated?.rating).toBe(4);
  });
});

describe('useBookStore — updateBook', () => {
  beforeEach(() => {
    useBookStore.setState({ books: getInitialBooks() });
  });

  it('keeps the book id stable across an update', () => {
    const book = createBook();

    useBookStore.getState().updateBook(book.id, { title: 'Renamed' });

    expect(findBook(book.id)?.id).toBe(book.id);
  });

  it('leaves the other books alone', () => {
    const first = createBook({ title: 'First' });
    const second = createBook({ title: 'Second' });

    useBookStore.getState().updateBook(first.id, { title: 'First, renamed' });

    expect(findBook(second.id)?.title).toBe('Second');
  });

  it('rejects an update that would blank the title', () => {
    const book = createBook();

    expect(() => useBookStore.getState().updateBook(book.id, { title: '   ' })).toThrow();
  });
});
