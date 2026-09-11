// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useChallengeStore } from '../features/challenge';
import { ChallengeBooksPage } from './challenge-books-page';

// Day one, midday. The page reads `new Date()` to decide which session counts
// as next, so the clock has to be pinned. The fixture has one technical
// session done — day one's, which rotated onto Micro Frontends in Action.
const pinnedNow = new Date(2026, 8, 11, 12, 0, 0);

function renderBooks() {
  return render(
    <MemoryRouter>
      <ChallengeBooksPage />
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

describe('ChallengeBooksPage — the two tracks', () => {
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
});

describe('ChallengeBooksPage — per-book progress', () => {
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

  it('says when each book is next scheduled', () => {
    renderBooks();

    expect(screen.getAllByText(/^Day \d+$/).length).toBeGreaterThan(0);
  });

  it('moves when another session for that book is completed', () => {
    // Day 3's technical slot rotated onto Domain-Driven Design Distilled: 176
    // pages, so one ten-page session is 6%.
    useChallengeStore.getState().toggleActivityCompletion(3, 'day-3-technical-reading');
    renderBooks();

    expect(
      screen.getByRole('progressbar', { name: 'Domain-Driven Design Distilled progress' }),
    ).toHaveAttribute('aria-valuenow', '6');
  });

  it('marks a book finished once its pages run out', () => {
    // Day 3 and day 9 both rotate onto Domain-Driven Design Distilled, but no
    // realistic number of sessions finishes a 176-page book here, so shrink the
    // book instead and check the cap and the badge together.
    useChallengeStore.setState((state) => ({
      books: state.books.map((book) =>
        book.id === 'ddd-distilled' ? { ...book, pageCount: 10 } : book,
      ),
    }));
    useChallengeStore.getState().toggleActivityCompletion(3, 'day-3-technical-reading');
    renderBooks();

    expect(
      screen.getByRole('progressbar', { name: 'Domain-Driven Design Distilled progress' }),
    ).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('Finished')).toBeInTheDocument();
  });
});

describe('ChallengeBooksPage — framing', () => {
  it('links the other challenge sections', () => {
    renderBooks();

    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('href', '/challenge');
    expect(screen.getByRole('link', { name: 'Streak' })).toHaveAttribute(
      'href',
      '/challenge/streak',
    );
  });

  it('totals the pages read against the pages available on each track', () => {
    renderBooks();

    const technical = screen.getByRole('region', { name: 'Technical reading' });

    // 736 + 176 + 400 + 300 + 462 + 190 = 2264, of which ten pages are read.
    expect(within(technical).getByText('10 of 2264 pages')).toBeInTheDocument();
  });
});
