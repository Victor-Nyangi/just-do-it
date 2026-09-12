// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useJourneyStore } from '../features/journeys';
import { JourneyBooksPage } from './journey-books-page';

// Day one, midday. The page reads `new Date()` to decide which session counts
// as next, so the clock has to be pinned. The fixture has one technical session
// done — day one's, which rotated onto Micro Frontends in Action.
const pinnedNow = new Date(2026, 8, 12, 12, 0, 0);
const ENROLLMENT_ID = 'enrollment-discipline';

function renderBooks(enrollmentId = ENROLLMENT_ID) {
  return render(
    <MemoryRouter initialEntries={[`/journeys/${enrollmentId}/books`]}>
      <Routes>
        <Route path="/journeys/:enrollmentId/books" element={<JourneyBooksPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(pinnedNow);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('JourneyBooksPage — the two tracks', () => {
  it('separates technical reading from growth reading', () => {
    renderBooks();

    expect(screen.getByRole('heading', { name: 'Technical reading' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Personal growth reading' })).toBeInTheDocument();
  });

  it('lists every technical book', () => {
    renderBooks();

    const technical = screen.getByRole('region', { name: 'Technical reading' });

    for (const title of [
      'Enterprise Integration Patterns',
      'Domain-Driven Design Distilled',
      'Building Large Scale Web Apps',
      'Micro Frontends in Action',
      'Software Architecture: The Hard Parts',
      'A Philosophy of Software Design',
    ]) {
      expect(within(technical).getByRole('heading', { name: title })).toBeInTheDocument();
    }
  });

  it('lists every growth book', () => {
    renderBooks();

    const growth = screen.getByRole('region', { name: 'Personal growth reading' });

    for (const title of [
      'The Laws of Human Nature',
      'The 48 Laws of Power',
      'The Power of Now',
      'Breaking the Habit of Being Yourself',
      'The Way of the Superior Man',
      'Outliers',
      'The Power of Your Subconscious Mind',
      'The Richest Man in Babylon',
      'The 5 AM Club',
      'The Courage to Be Disliked',
      "Man's Search for Meaning",
      'The Red Book',
      'The Myth of Sisyphus',
    ]) {
      expect(within(growth).getByRole('heading', { name: title })).toBeInTheDocument();
    }
  });

  it('keeps a book on one track only', () => {
    renderBooks();

    const growth = screen.getByRole('region', { name: 'Personal growth reading' });

    expect(
      within(growth).queryByRole('heading', { name: 'Micro Frontends in Action' }),
    ).not.toBeInTheDocument();
  });

  // A journey with one track should not render an empty section for the other.
  it('omits a track the journey has no books for', () => {
    const enrollmentId = useJourneyStore
      .getState()
      .enrollInJourney('deep-work-reset', '2026-09-12');

    if (!enrollmentId) throw new Error('Expected an enrollment');

    renderBooks(enrollmentId);

    expect(screen.getByRole('heading', { name: 'Technical reading' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Personal growth reading' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Deep Work' })).toBeInTheDocument();
  });
});

describe('JourneyBooksPage — per-book progress', () => {
  // Micro Frontends in Action is 300 pages and day one's completed technical
  // session is worth ten of them, so 3%.
  it('turns a completed session into a percentage', () => {
    renderBooks();

    expect(
      screen.getByRole('progressbar', { name: 'Micro Frontends in Action progress' }),
    ).toHaveAttribute('aria-valuenow', '3');
    expect(screen.getByText('10 of 300 pages')).toBeInTheDocument();
  });

  it('leaves an unread book at zero', () => {
    renderBooks();

    expect(
      screen.getByRole('progressbar', { name: 'A Philosophy of Software Design progress' }),
    ).toHaveAttribute('aria-valuenow', '0');
  });

  it('gives every book its own progressbar', () => {
    renderBooks();

    expect(screen.getAllByRole('progressbar')).toHaveLength(19);
  });

  it('moves when another session for that book is completed', () => {
    // Day 3's technical slot rotated onto Domain-Driven Design Distilled: 176
    // pages, so one ten-page session is 6%.
    useJourneyStore
      .getState()
      .toggleActivityCompletion(ENROLLMENT_ID, 3, 'day-3-technical-reading');
    renderBooks();

    expect(
      screen.getByRole('progressbar', { name: 'Domain-Driven Design Distilled progress' }),
    ).toHaveAttribute('aria-valuenow', '6');
  });

  it('marks a book finished once its pages run out', () => {
    // No realistic number of sessions finishes a 176-page book here, so shrink
    // the book instead and check the cap and the badge together.
    useJourneyStore.setState((state) => ({
      journeys: state.journeys.map((journey) =>
        journey.id === 'hundred-day-discipline'
          ? {
              ...journey,
              books: journey.books.map((book) =>
                book.id === 'ddd-distilled' ? { ...book, pageCount: 10 } : book,
              ),
            }
          : journey,
      ),
    }));
    useJourneyStore
      .getState()
      .toggleActivityCompletion(ENROLLMENT_ID, 3, 'day-3-technical-reading');
    renderBooks();

    expect(
      screen.getByRole('progressbar', { name: 'Domain-Driven Design Distilled progress' }),
    ).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('Finished')).toBeInTheDocument();
  });
});

describe('JourneyBooksPage — framing', () => {
  it('scopes its section links to the enrollment', () => {
    renderBooks();

    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute(
      'href',
      `/journeys/${ENROLLMENT_ID}`,
    );
  });

  it('totals the pages read against the pages available on each track', () => {
    renderBooks();

    const technical = screen.getByRole('region', { name: 'Technical reading' });

    // 736 + 176 + 400 + 300 + 462 + 190 = 2264, of which ten pages are read.
    expect(within(technical).getByText('10 of 2264 pages')).toBeInTheDocument();
  });

  it('explains itself when the enrollment does not exist', () => {
    renderBooks('nope');

    expect(
      screen.getByRole('heading', { name: 'This journey is not in your list' }),
    ).toBeInTheDocument();
  });
});
