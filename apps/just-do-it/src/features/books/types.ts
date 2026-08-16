export const BOOK_STATUS_VALUES = ['want_to_read', 'reading', 'finished'] as const

export type BookStatus = (typeof BOOK_STATUS_VALUES)[number]

export type Book = {
  id: string
  title: string
  author: string
  status: BookStatus
  rating?: number
  note?: string
}

export type BookInput = Pick<Book, 'author' | 'status' | 'title'> &
  Partial<Pick<Book, 'note' | 'rating'>>

export type BookUpdateInput = Partial<Pick<Book, 'author' | 'note' | 'rating' | 'status' | 'title'>>
