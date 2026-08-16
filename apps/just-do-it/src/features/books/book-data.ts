import { z } from 'zod'

import booksFixture from '../../data/books.json'
import { BOOK_STATUS_VALUES, type Book } from './types'

const bookFixtureSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  author: z.string().trim().min(1),
  status: z.enum(BOOK_STATUS_VALUES),
})

export const bookSchema = bookFixtureSchema.extend({
  rating: z.number().int().min(1).max(5).optional(),
  note: z.string().trim().min(1).optional(),
})

export const bookListSchema = z.array(bookSchema)

const validatedBookFixture = z.array(bookFixtureSchema).parse(booksFixture)

const validatedBookData = validatedBookFixture.map((book) => bookSchema.parse(book))

export function cloneBook(book: Book): Book {
  return { ...book }
}

export function getInitialBooks(): Book[] {
  return validatedBookData.map(cloneBook)
}

export { validatedBookData, validatedBookFixture }
