// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { useBookStore } from '../features/books';
import { BooksPage } from './books-page';

// The fixture ships two books: "Atomic Habits" (reading) and "The Pragmatic
// Programmer" (want_to_read). The Finished shelf starts empty, which is what
// makes both the populated and the empty section states reachable in one
// render. Nothing here reads the clock, so no clock is pinned.

// The empty-state "Add a book" button calls `focusComposer`, which calls
// `scrollIntoView`. jsdom leaves that property undefined rather than stubbing
// it, so it has to be assigned outright — `vi.spyOn` cannot wrap what does not
// exist. See tasks-page.test.tsx for the same trap.
Element.prototype.scrollIntoView = vi.fn();

function renderBooks() {
  return render(
    <MemoryRouter>
      <BooksPage />
    </MemoryRouter>,
  );
}

function setUpUser() {
  return userEvent.setup();
}

// Each shelf is a `<section aria-labelledby>`, so it exposes a region with the
// heading as its accessible name. Scoping to it is what makes "the book is on
// the Finished shelf" assertable — the status buttons and the note fields
// repeat their names on every card, so page-wide queries are ambiguous.
function getShelf(name: 'Currently Reading' | 'Want to Read' | 'Finished') {
  return within(screen.getByRole('region', { name }));
}

// The composer repeats "Notes" from the book cards, so its fields are scoped to
// its form, anchored on the "Title" label — which only the composer has.
function getComposer() {
  const form = screen.getByLabelText('Title').closest('form');
  if (!form) throw new Error('expected the composer form');

  return within(form);
}

function findBook(title: string) {
  return useBookStore.getState().books.find((book) => book.title === title);
}

describe('BooksPage — the shelves', () => {
  it('files each book under its status', () => {
    renderBooks();

    expect(getShelf('Currently Reading').getByText('Atomic Habits')).toBeInTheDocument();
    expect(getShelf('Want to Read').getByText('The Pragmatic Programmer')).toBeInTheDocument();
  });

  it('shows an empty shelf rather than omitting it', () => {
    renderBooks();

    expect(
      getShelf('Finished').getByRole('heading', { name: 'No finished books yet' }),
    ).toBeInTheDocument();
  });

  // Singular copy, which a naive `${n} books` template would get wrong.
  it('counts each shelf, in the singular where it should be', () => {
    renderBooks();

    expect(getShelf('Currently Reading').getByText('1 book')).toBeInTheDocument();
    expect(getShelf('Finished').getByText('0 books')).toBeInTheDocument();
  });
});

describe('BooksPage — moving a book between shelves', () => {
  it('moves the book and empties the shelf it came from', async () => {
    const user = setUpUser();
    renderBooks();

    await user.click(
      within(screen.getByRole('group', { name: 'Change Atomic Habits status' })).getByRole(
        'button',
        { name: 'Finished' },
      ),
    );

    expect(getShelf('Finished').getByText('Atomic Habits')).toBeInTheDocument();
    expect(
      getShelf('Currently Reading').getByRole('heading', {
        name: 'Nothing is being read right now',
      }),
    ).toBeInTheDocument();
    expect(findBook('Atomic Habits')?.status).toBe('finished');
  });

  it('marks the current status as pressed', () => {
    renderBooks();

    const statusGroup = within(screen.getByRole('group', { name: 'Change Atomic Habits status' }));

    expect(statusGroup.getByRole('button', { name: 'Currently reading' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(statusGroup.getByRole('button', { name: 'Finished' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

describe('BooksPage — rating', () => {
  it('rates a book', async () => {
    const user = setUpUser();
    renderBooks();

    await user.click(screen.getByRole('button', { name: 'Rate Atomic Habits 4 stars' }));

    expect(findBook('Atomic Habits')?.rating).toBe(4);
  });

  // The rating buttons carry no `aria-pressed` — selection is conveyed by colour
  // and a filled icon alone — so the state has to be read from the store. That
  // is a gap in the page rather than in the test; see the plan's debt list.
  it('clears the rating when the same star is pressed again', async () => {
    const user = setUpUser();
    renderBooks();

    await user.click(screen.getByRole('button', { name: 'Rate Atomic Habits 4 stars' }));
    await user.click(screen.getByRole('button', { name: 'Rate Atomic Habits 4 stars' }));

    expect(findBook('Atomic Habits')?.rating).toBeUndefined();
  });

  it('uses the singular for a one-star rating', () => {
    renderBooks();

    expect(screen.getByRole('button', { name: 'Rate Atomic Habits 1 star' })).toBeInTheDocument();
  });
});

describe('BooksPage — per-book notes', () => {
  it('cannot save a note until one is written', () => {
    renderBooks();

    expect(getShelf('Currently Reading').getByRole('button', { name: 'Save note' })).toBeDisabled();
  });

  it('saves a note against the book', async () => {
    const user = setUpUser();
    renderBooks();

    const shelf = getShelf('Currently Reading');
    await user.type(shelf.getByLabelText('Notes'), 'Start with the two-minute rule.');
    await user.click(shelf.getByRole('button', { name: 'Save note' }));

    expect(findBook('Atomic Habits')?.note).toBe('Start with the two-minute rule.');
  });
});

describe('BooksPage — the composer', () => {
  it('adds a book onto the shelf chosen for it', async () => {
    const user = setUpUser();
    renderBooks();

    await user.type(getComposer().getByLabelText('Title'), 'Deep Work');
    await user.type(getComposer().getByLabelText('Author'), 'Cal Newport');
    await user.click(
      within(screen.getByRole('group', { name: 'Choose book status' })).getByRole('button', {
        name: 'Currently reading',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Add book' }));

    expect(getShelf('Currently Reading').getByText('Deep Work')).toBeInTheDocument();
    expect(findBook('Deep Work')).toMatchObject({ author: 'Cal Newport', status: 'reading' });
  });

  it('clears the form after adding', async () => {
    const user = setUpUser();
    renderBooks();

    await user.type(getComposer().getByLabelText('Title'), 'Deep Work');
    await user.type(getComposer().getByLabelText('Author'), 'Cal Newport');
    await user.click(screen.getByRole('button', { name: 'Add book' }));

    expect(getComposer().getByLabelText('Title')).toHaveValue('');
    expect(getComposer().getByLabelText('Author')).toHaveValue('');
  });

  // What actually stops this is the `required` attribute on the author field:
  // the browser refuses to submit the form, so `handleCreateBook` never runs
  // and its own title/author check is unreachable from the UI. Deleting that
  // check alone changes nothing (confirmed by mutation) — this test pins the
  // native validation, which is the behaviour a user meets.
  //
  // The window `error` listener still earns its place: it is what would fail if
  // both the attribute and the guard went, since `bookSchema` requires an
  // author and would throw rather than write a half-filled book.
  it('refuses a book with no author, without throwing', async () => {
    const user = setUpUser();
    const countBefore = useBookStore.getState().books.length;
    const uncaught: string[] = [];
    const recordError = (event: ErrorEvent) => {
      uncaught.push(String(event.error ?? event.message));
    };
    window.addEventListener('error', recordError);

    try {
      renderBooks();

      await user.type(getComposer().getByLabelText('Title'), 'Deep Work');
      await user.click(screen.getByRole('button', { name: 'Add book' }));

      expect(useBookStore.getState().books).toHaveLength(countBefore);
      expect(uncaught).toEqual([]);
    } finally {
      window.removeEventListener('error', recordError);
    }
  });

  it('refuses a book with no title', async () => {
    const user = setUpUser();
    const countBefore = useBookStore.getState().books.length;
    renderBooks();

    await user.type(getComposer().getByLabelText('Author'), 'Cal Newport');
    await user.click(screen.getByRole('button', { name: 'Add book' }));

    expect(useBookStore.getState().books).toHaveLength(countBefore);
  });
});
