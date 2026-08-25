import { create } from 'zustand';

import { bookSchema, getInitialBooks } from './book-data';
import type { Book, BookInput, BookStatus, BookUpdateInput } from './types';

type BookStoreState = {
  books: Book[];
  createBook: (input: BookInput) => void;
  updateBook: (bookId: string, input: BookUpdateInput) => void;
  updateBookNote: (bookId: string, note?: string) => void;
  updateBookRating: (bookId: string, rating?: number) => void;
  updateBookStatus: (bookId: string, status: BookStatus) => void;
};

function normalizeBookNote(note?: string): string | undefined {
  const value = note?.trim();
  return value ? value : undefined;
}

function normalizeBookRating(rating?: number): number | undefined {
  if (rating === undefined) return undefined;

  return Math.max(1, Math.min(5, Math.round(rating)));
}

function buildBookRecord(
  bookId: string,
  input: BookInput | BookUpdateInput,
  existingBook?: Book,
): Book {
  return bookSchema.parse({
    ...existingBook,
    ...input,
    id: existingBook?.id ?? bookId,
    // `in` rather than a presence check on the value, so an explicit undefined
    // clears the field. Comparing against undefined made the rating "Clear"
    // button and "Clear note" silently restore the previous value.
    note: 'note' in input ? normalizeBookNote(input.note) : existingBook?.note,
    rating: 'rating' in input ? normalizeBookRating(input.rating) : existingBook?.rating,
  });
}

export const useBookStore = create<BookStoreState>()((set) => ({
  books: getInitialBooks(),
  createBook: (input) => {
    set((state) => ({
      books: [...state.books, buildBookRecord(crypto.randomUUID(), input)],
    }));
  },
  updateBook: (bookId, input) => {
    set((state) => ({
      books: state.books.map((book) =>
        book.id === bookId ? buildBookRecord(bookId, input, book) : book,
      ),
    }));
  },
  updateBookNote: (bookId, note) => {
    set((state) => ({
      books: state.books.map((book) =>
        book.id === bookId ? buildBookRecord(bookId, { note }, book) : book,
      ),
    }));
  },
  updateBookRating: (bookId, rating) => {
    set((state) => ({
      books: state.books.map((book) =>
        book.id === bookId ? buildBookRecord(bookId, { rating }, book) : book,
      ),
    }));
  },
  updateBookStatus: (bookId, status) => {
    set((state) => ({
      books: state.books.map((book) =>
        book.id === bookId ? buildBookRecord(bookId, { status }, book) : book,
      ),
    }));
  },
}));
