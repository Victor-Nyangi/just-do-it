import { create } from 'zustand'

import { bookSchema, getInitialBooks } from './book-data'
import type { Book, BookStatus, BookUpdateInput } from './types'

type BookStoreState = {
  books: Book[]
  updateBook: (bookId: string, input: BookUpdateInput) => void
  updateBookNote: (bookId: string, note?: string) => void
  updateBookRating: (bookId: string, rating?: number) => void
  updateBookStatus: (bookId: string, status: BookStatus) => void
}

function normalizeBookNote(note?: string): string | undefined {
  const value = note?.trim()
  return value ? value : undefined
}

function normalizeBookRating(rating?: number): number | undefined {
  if (rating === undefined) return undefined

  return Math.max(1, Math.min(5, Math.round(rating)))
}

function buildBookRecord(book: Book, input: BookUpdateInput): Book {
  return bookSchema.parse({
    ...book,
    ...input,
    note: input.note === undefined ? book.note : normalizeBookNote(input.note),
    rating: input.rating === undefined ? book.rating : normalizeBookRating(input.rating),
  })
}

export const useBookStore = create<BookStoreState>()((set) => ({
  books: getInitialBooks(),
  updateBook: (bookId, input) => {
    set((state) => ({
      books: state.books.map((book) =>
        book.id === bookId ? buildBookRecord(book, input) : book,
      ),
    }))
  },
  updateBookNote: (bookId, note) => {
    set((state) => ({
      books: state.books.map((book) =>
        book.id === bookId ? buildBookRecord(book, { note }) : book,
      ),
    }))
  },
  updateBookRating: (bookId, rating) => {
    set((state) => ({
      books: state.books.map((book) =>
        book.id === bookId ? buildBookRecord(book, { rating }) : book,
      ),
    }))
  },
  updateBookStatus: (bookId, status) => {
    set((state) => ({
      books: state.books.map((book) =>
        book.id === bookId ? buildBookRecord(book, { status }) : book,
      ),
    }))
  },
}))
