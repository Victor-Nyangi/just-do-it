import { BookOpen, CheckCircle2, LibraryBig, Plus, Sparkles, Star } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { Badge, Button, Card, Input, cn } from '@just-do-it/ui';
import {
  useBooks,
  useCreateBook,
  useUpdateBookNote,
  useUpdateBookRating,
  useUpdateBookStatus,
  type Book,
  type BookStatus,
} from '../features/books';

const controlClassName =
  'min-h-10 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]';

const visibleBookStatuses = [
  'reading',
  'want_to_read',
  'finished',
] as const satisfies readonly BookStatus[];
const ratingValues = [1, 2, 3, 4, 5] as const;

type VisibleBookStatus = (typeof visibleBookStatuses)[number];

type BookComposerValues = {
  title: string;
  author: string;
  status: VisibleBookStatus;
  rating: string;
  note: string;
};

type BookSectionConfig = {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  status: VisibleBookStatus;
};

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning';

const bookSections: readonly BookSectionConfig[] = [
  {
    status: 'reading',
    title: 'Currently Reading',
    description: 'Books already in motion, with quick status, rating, and note updates inline.',
    emptyTitle: 'Nothing is being read right now',
    emptyDescription: 'Add a book directly into the current stack or move one here when you begin.',
  },
  {
    status: 'want_to_read',
    title: 'Want to Read',
    description: 'Keep the queue visible so the next read is always ready.',
    emptyTitle: 'The reading queue is clear',
    emptyDescription: 'Capture the next title you want on deck before it slips away.',
  },
  {
    status: 'finished',
    title: 'Finished',
    description: 'Collect completed reads and keep ratings or takeaways close at hand.',
    emptyTitle: 'No finished books yet',
    emptyDescription: 'Move a book here when you finish it to keep a satisfying session trail.',
  },
] as const;

function createDefaultBookValues(): BookComposerValues {
  return {
    title: '',
    author: '',
    status: 'want_to_read',
    rating: '',
    note: '',
  };
}

function normalizeDraftNote(note: string): string | undefined {
  const value = note.trim();
  return value ? value : undefined;
}

function formatBookStatusLabel(status: VisibleBookStatus): string {
  return status === 'reading'
    ? 'Currently reading'
    : status === 'want_to_read'
      ? 'Want to read'
      : 'Finished';
}

function sortBooks(books: readonly Book[]): Book[] {
  return [...books].sort((leftBook, rightBook) => leftBook.title.localeCompare(rightBook.title));
}

function BookStatusButton({
  active,
  onClick,
  status,
}: {
  active: boolean;
  onClick: () => void;
  status: VisibleBookStatus;
}) {
  const activeClassName =
    status === 'reading'
      ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]'
      : status === 'finished'
        ? 'border-[var(--success)] bg-[var(--success-subtle)] text-[var(--success)]'
        : 'border-[var(--primary)] bg-[var(--primary-subtle)] text-[var(--primary)]';

  return (
    <button
      aria-pressed={active}
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2',
        active
          ? activeClassName
          : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]',
      )}
      onClick={onClick}
      type="button"
    >
      {formatBookStatusLabel(status)}
    </button>
  );
}

function BooksEmptyState({
  description,
  onAddBook,
  title,
}: {
  description: string;
  onAddBook: () => void;
  title: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--muted-foreground)]">
        <BookOpen aria-hidden="true" className="size-6" />
      </div>
      <h3 className="mt-4 text-lg font-bold">{title}</h3>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">{description}</p>
      <Button className="mt-4" onClick={onAddBook}>
        <Plus aria-hidden="true" className="mr-2 size-4" />
        Add a book
      </Button>
    </div>
  );
}

function BookCard({
  book,
  onStatusChange,
  onRatingChange,
  onNoteChange,
}: {
  book: Book;
  onStatusChange: (bookId: string, status: VisibleBookStatus) => void;
  onRatingChange: (bookId: string, rating?: number) => void;
  onNoteChange: (bookId: string, note?: string) => void;
}) {
  const [draftNote, setDraftNote] = useState(book.note ?? '');

  useEffect(() => {
    setDraftNote(book.note ?? '');
  }, [book.id, book.note]);

  const normalizedDraftNote = normalizeDraftNote(draftNote);
  const hasNoteChanged = normalizedDraftNote !== book.note;

  return (
    <article>
      <Card className="space-y-5" variant={book.status === 'finished' ? 'subtle' : 'default'}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <Badge
              tone={
                book.status === 'finished'
                  ? 'success'
                  : book.status === 'reading'
                    ? 'accent'
                    : 'neutral'
              }
            >
              {formatBookStatusLabel(book.status)}
            </Badge>
            <div>
              <h3 className="text-lg font-bold">{book.title}</h3>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">{book.author}</p>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 lg:min-w-52">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
              Current rating
            </p>
            <p className="mt-1 text-lg font-bold">
              {book.rating ? `${book.rating}/5` : 'Not rated'}
            </p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {book.note ? 'Notes saved for this book.' : 'Add a note to remember why it matters.'}
            </p>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Reading status</p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Switch sections without leaving the page.
              </p>
            </div>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label={`Change ${book.title} status`}
            >
              {visibleBookStatuses.map((status) => (
                <BookStatusButton
                  active={book.status === status}
                  key={status}
                  onClick={() => onStatusChange(book.id, status)}
                  status={status}
                />
              ))}
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Rating</legend>
            <div className="flex flex-wrap items-center gap-2">
              {ratingValues.map((rating) => {
                const active = book.rating === rating;

                return (
                  <button
                    aria-label={`Rate ${book.title} ${rating} star${rating === 1 ? '' : 's'}`}
                    className={cn(
                      'inline-flex min-w-11 items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2',
                      active
                        ? 'border-[var(--warning)] bg-[var(--warning-subtle)] text-[var(--warning)]'
                        : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]',
                    )}
                    key={rating}
                    onClick={() => onRatingChange(book.id, active ? undefined : rating)}
                    type="button"
                  >
                    <Star
                      aria-hidden="true"
                      className={cn('mr-1 size-4', active && 'fill-current')}
                    />
                    {rating}
                  </button>
                );
              })}
              <Button
                onClick={() => onRatingChange(book.id, undefined)}
                type="button"
                variant="secondary"
              >
                Clear
              </Button>
            </div>
          </fieldset>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={`book-note-${book.id}`}>
            Notes
          </label>
          <textarea
            className={controlClassName}
            id={`book-note-${book.id}`}
            onChange={(event) => setDraftNote(event.target.value)}
            placeholder="Capture a takeaway, why you picked it, or what to revisit later."
            rows={4}
            value={draftNote}
          />
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={!hasNoteChanged}
              onClick={() => onNoteChange(book.id, normalizedDraftNote)}
              type="button"
            >
              Save note
            </Button>
            <Button
              disabled={!book.note && !normalizedDraftNote}
              onClick={() => {
                setDraftNote('');
                onNoteChange(book.id, undefined);
              }}
              type="button"
              variant="secondary"
            >
              Clear note
            </Button>
          </div>
        </div>
      </Card>
    </article>
  );
}

function BookSection({
  books,
  config,
  onAddBook,
  onNoteChange,
  onRatingChange,
  onStatusChange,
}: {
  books: readonly Book[];
  config: BookSectionConfig;
  onAddBook: () => void;
  onNoteChange: (bookId: string, note?: string) => void;
  onRatingChange: (bookId: string, rating?: number) => void;
  onStatusChange: (bookId: string, status: VisibleBookStatus) => void;
}) {
  const badgeTone: BadgeTone =
    config.status === 'finished' ? 'success' : config.status === 'reading' ? 'accent' : 'neutral';

  return (
    <section aria-labelledby={`books-section-${config.status}`}>
      <Card>
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold" id={`books-section-${config.status}`}>
              {config.title}
            </h2>
            <p className="text-sm text-[var(--muted-foreground)]">{config.description}</p>
          </div>
          <Badge tone={badgeTone}>
            {books.length} book{books.length === 1 ? '' : 's'}
          </Badge>
        </div>

        {books.length === 0 ? (
          <BooksEmptyState
            description={config.emptyDescription}
            onAddBook={onAddBook}
            title={config.emptyTitle}
          />
        ) : (
          <ul className="space-y-4">
            {books.map((book) => (
              <li key={book.id}>
                <BookCard
                  book={book}
                  onNoteChange={onNoteChange}
                  onRatingChange={onRatingChange}
                  onStatusChange={onStatusChange}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

export function BooksPage() {
  const books = useBooks();
  const createBook = useCreateBook();
  const updateBookNote = useUpdateBookNote();
  const updateBookRating = useUpdateBookRating();
  const updateBookStatus = useUpdateBookStatus();
  const composerRef = useRef<HTMLDivElement | null>(null);

  const [formValues, setFormValues] = useState<BookComposerValues>(() => createDefaultBookValues());

  const sortedBooks = useMemo(() => sortBooks(books), [books]);
  const readingBooks = useMemo(
    () => sortedBooks.filter((book) => book.status === 'reading'),
    [sortedBooks],
  );
  const wantToReadBooks = useMemo(
    () => sortedBooks.filter((book) => book.status === 'want_to_read'),
    [sortedBooks],
  );
  const finishedBooks = useMemo(
    () => sortedBooks.filter((book) => book.status === 'finished'),
    [sortedBooks],
  );
  const ratedBookCount = useMemo(
    () => sortedBooks.filter((book) => book.rating !== undefined).length,
    [sortedBooks],
  );
  const notedBookCount = useMemo(
    () => sortedBooks.filter((book) => book.note !== undefined).length,
    [sortedBooks],
  );

  function focusComposer() {
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetForm() {
    setFormValues(createDefaultBookValues());
  }

  function handleCreateBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formValues.title.trim() || !formValues.author.trim()) {
      return;
    }

    const parsedRating = Number.parseInt(formValues.rating, 10);

    createBook({
      title: formValues.title,
      author: formValues.author,
      status: formValues.status,
      rating: Number.isNaN(parsedRating) ? undefined : parsedRating,
      note: formValues.note,
    });
    resetForm();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <section className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <Badge tone="accent">Phase 10 · Books</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Books</h1>
          <p className="mt-2 max-w-2xl text-[var(--muted-foreground)]">
            Keep the reading stack tidy with session-local sections for what is active, queued, and
            done.
          </p>
        </div>
        <Button onClick={focusComposer}>
          <Plus aria-hidden="true" className="mr-2 size-4" />
          Add a book
        </Button>
      </section>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="space-y-3" variant="subtle">
          <div className="flex items-center gap-3">
            <BookOpen aria-hidden="true" className="size-5 text-[var(--accent)]" />
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Currently reading</p>
              <p className="text-2xl font-bold">{readingBooks.length}</p>
            </div>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            {readingBooks.length === 0
              ? 'Nothing is open right now.'
              : `${readingBooks.length} book${readingBooks.length === 1 ? '' : 's'} actively in progress.`}
          </p>
        </Card>

        <Card className="space-y-3" variant="subtle">
          <div className="flex items-center gap-3">
            <LibraryBig aria-hidden="true" className="size-5 text-[var(--primary)]" />
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Want to read</p>
              <p className="text-2xl font-bold">{wantToReadBooks.length}</p>
            </div>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            {wantToReadBooks.length === 0
              ? 'The queue is empty for now.'
              : `${wantToReadBooks.length} book${wantToReadBooks.length === 1 ? '' : 's'} waiting in the queue.`}
          </p>
        </Card>

        <Card className="space-y-3" variant="subtle">
          <div className="flex items-center gap-3">
            <CheckCircle2 aria-hidden="true" className="size-5 text-[var(--success)]" />
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Finished</p>
              <p className="text-2xl font-bold">{finishedBooks.length}</p>
            </div>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            {finishedBooks.length === 0
              ? 'Finish a book to start the archive.'
              : `${ratedBookCount} rated · ${notedBookCount} with notes across the shelf.`}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <div className="space-y-6">
          {bookSections.map((config) => (
            <BookSection
              books={
                config.status === 'reading'
                  ? readingBooks
                  : config.status === 'want_to_read'
                    ? wantToReadBooks
                    : finishedBooks
              }
              config={config}
              key={config.status}
              onAddBook={focusComposer}
              onNoteChange={updateBookNote}
              onRatingChange={updateBookRating}
              onStatusChange={(bookId, status) => updateBookStatus(bookId, status)}
            />
          ))}
        </div>

        <div className="space-y-6">
          <div ref={composerRef}>
            <Card>
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <Badge tone="neutral">Book composer</Badge>
                  <h2 className="mt-3 text-lg font-bold">Add a book</h2>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    Create a new session-local entry with an initial status, rating, and optional
                    note.
                  </p>
                </div>
                <Sparkles aria-hidden="true" className="size-5 text-[var(--muted-foreground)]" />
              </div>

              <form className="space-y-4" onSubmit={handleCreateBook}>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="book-title">
                    Title
                  </label>
                  <Input
                    id="book-title"
                    onChange={(event) =>
                      setFormValues((current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="Deep Work"
                    required
                    value={formValues.title}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="book-author">
                    Author
                  </label>
                  <Input
                    id="book-author"
                    onChange={(event) =>
                      setFormValues((current) => ({ ...current, author: event.target.value }))
                    }
                    placeholder="Cal Newport"
                    required
                    value={formValues.author}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-[1.15fr_0.85fr]">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Initial status</p>
                    <div
                      className="flex flex-wrap gap-2"
                      role="group"
                      aria-label="Choose book status"
                    >
                      {visibleBookStatuses.map((status) => (
                        <BookStatusButton
                          active={formValues.status === status}
                          key={status}
                          onClick={() => setFormValues((current) => ({ ...current, status }))}
                          status={status}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="book-rating">
                      Initial rating
                    </label>
                    <Input
                      id="book-rating"
                      max={5}
                      min={1}
                      onChange={(event) =>
                        setFormValues((current) => ({ ...current, rating: event.target.value }))
                      }
                      placeholder="Optional"
                      type="number"
                      value={formValues.rating}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="book-note">
                    Notes
                  </label>
                  <textarea
                    className={controlClassName}
                    id="book-note"
                    onChange={(event) =>
                      setFormValues((current) => ({ ...current, note: event.target.value }))
                    }
                    placeholder="Why you picked it, what to revisit, or a note for later."
                    rows={4}
                    value={formValues.note}
                  />
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <Button type="submit">Add book</Button>
                  <Button onClick={resetForm} type="button" variant="secondary">
                    Reset
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          <Card variant="accent">
            <h2 className="text-lg font-bold">Session-local shelf</h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              This page uses the in-memory books store for quick local editing. Refreshing restores
              the validated fixture set.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
