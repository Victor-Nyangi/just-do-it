import { useBookStore } from './book-store';

export function useBooks() {
  return useBookStore((state) => state.books);
}

export function useCreateBook() {
  return useBookStore((state) => state.createBook);
}

export function useUpdateBook() {
  return useBookStore((state) => state.updateBook);
}

export function useUpdateBookNote() {
  return useBookStore((state) => state.updateBookNote);
}

export function useUpdateBookRating() {
  return useBookStore((state) => state.updateBookRating);
}

export function useUpdateBookStatus() {
  return useBookStore((state) => state.updateBookStatus);
}
