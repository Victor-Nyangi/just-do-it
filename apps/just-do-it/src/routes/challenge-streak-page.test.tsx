// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildDayPlan, useChallengeStore } from '../features/challenge';
import { ChallengeStreakPage } from './challenge-streak-page';

// Midday on day five. Far enough in that there are finished days behind, a day
// in hand, and ninety-five ahead — which is what makes every dot state
// reachable in one render.
const pinnedNow = new Date(2026, 8, 15, 12, 0, 0);

function renderStreak() {
  return render(
    <MemoryRouter>
      <ChallengeStreakPage />
    </MemoryRouter>,
  );
}

// The fixture only seeds two completions on day one, so a test that needs
// finished days has to build them — through the store action, so the same
// guards the UI goes through apply here too.
function completeWholeDays(dayIndexes: readonly number[]) {
  const { challenge, books, toggleActivityCompletion } = useChallengeStore.getState();

  for (const dayIndex of dayIndexes) {
    for (const activity of buildDayPlan(challenge, books, dayIndex)?.activities ?? []) {
      if (
        !useChallengeStore
          .getState()
          .completions.some((completion) => completion.activityId === activity.id)
      ) {
        toggleActivityCompletion(dayIndex, activity.id);
      }
    }
  }
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(pinnedNow);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ChallengeStreakPage — the stats cards', () => {
  it('places the day within the hundred', () => {
    renderStreak();

    expect(screen.getByText('Day 5 of 100, with 95 still to go.')).toBeInTheDocument();
  });

  it('starts every streak at zero when nothing has been finished', () => {
    renderStreak();

    const currentStreak = screen.getByText('Current streak').closest('div');

    expect(within(currentStreak as HTMLElement).getByText('0')).toBeInTheDocument();
  });

  it('counts a run of finished days', () => {
    completeWholeDays([1, 2, 3, 4]);
    renderStreak();

    const currentStreak = screen.getByText('Current streak').closest('div');
    const longestStreak = screen.getByText('Longest streak').closest('div');

    expect(within(currentStreak as HTMLElement).getByText('4')).toBeInTheDocument();
    expect(within(longestStreak as HTMLElement).getByText('4')).toBeInTheDocument();
  });

  it('counts the days finished against the days elapsed', () => {
    completeWholeDays([1, 2]);
    renderStreak();

    expect(screen.getByText('Out of 5 elapsed')).toBeInTheDocument();
  });

  it('counts the activities done against the whole challenge', () => {
    renderStreak();

    expect(screen.getByText('Of 486 across the challenge')).toBeInTheDocument();
    // The two the fixture seeds on day one.
    const activitiesDone = screen.getByText('Activities done').closest('div');
    expect(within(activitiesDone as HTMLElement).getByText('2')).toBeInTheDocument();
  });
});

describe('ChallengeStreakPage — the activity map', () => {
  it('draws one dot per day of the challenge', () => {
    renderStreak();

    const map = screen.getByRole('heading', { name: 'Activity map' }).closest('section');

    expect(within(map as HTMLElement).getAllByRole('listitem')).toHaveLength(
      // The hundred day dots plus the five legend entries.
      105,
    );
  });

  // Each dot carries its own label rather than encoding the day purely as a
  // background colour, so the map is readable without seeing it.
  it('labels a finished day, a missed one and one still ahead', () => {
    completeWholeDays([1]);
    renderStreak();

    expect(
      screen.getByRole('listitem', { name: 'Day 1, 11 Sep 2026 — complete' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('listitem', { name: 'Day 2, 12 Sep 2026 — missed' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('listitem', { name: 'Day 40, 20 Oct 2026 — upcoming' }),
    ).toBeInTheDocument();
  });

  // A missed day and the day still in hand have both done nothing, so the
  // counts alone cannot tell them apart — only the status word can.
  it('tells the day in progress apart from a day that was missed', () => {
    renderStreak();

    expect(
      screen.getByRole('listitem', { name: 'Day 5, 15 Sep 2026 — in progress, nothing done yet' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('listitem', { name: 'Day 4, 14 Sep 2026 — missed' }),
    ).toBeInTheDocument();
  });

  it('labels a partly finished day with how far it got', () => {
    useChallengeStore.getState().toggleActivityCompletion(2, 'day-2-reflection');
    renderStreak();

    expect(
      screen.getByRole('listitem', { name: 'Day 2, 12 Sep 2026 — 1 of 5 done' }),
    ).toBeInTheDocument();
  });

  it('explains what the colours mean', () => {
    renderStreak();

    for (const label of ['Complete', 'Partly done', 'In progress', 'Missed', 'Upcoming']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});

describe('ChallengeStreakPage — the breakdown', () => {
  it('gives every category its own progressbar', () => {
    renderStreak();

    for (const category of ['Physical', 'Technical reading', 'Growth reading', 'Reflection']) {
      expect(screen.getByRole('progressbar', { name: `${category} progress` })).toBeInTheDocument();
    }
  });

  // Three of the four categories total 100, so each count has to be read
  // inside its own card rather than off the page.
  function categoryCount(category: string): string {
    const heading = screen.getByRole('heading', { name: category });

    return (
      within(heading.closest('div') as HTMLElement).getByText(/^\d+ of \d+$/).textContent ?? ''
    );
  }

  it('counts each category against its own total', () => {
    renderStreak();

    // One reflection per day across the hundred, and one reading session per
    // track per day; the physical rotation carries more than one on most days.
    expect(categoryCount('Reflection')).toBe('0 of 100');
    expect(categoryCount('Technical reading')).toBe('1 of 100');
    expect(categoryCount('Physical')).toBe('1 of 186');
  });

  it('moves a category when one of its activities is completed', () => {
    useChallengeStore.getState().toggleActivityCompletion(2, 'day-2-reflection');
    renderStreak();

    expect(categoryCount('Reflection')).toBe('1 of 100');
  });

  it('reports overall progress across every activity', () => {
    renderStreak();

    expect(screen.getByRole('progressbar', { name: 'Overall challenge progress' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
    expect(screen.getByText('2 of 486 activities ticked off.')).toBeInTheDocument();
  });
});

describe('ChallengeStreakPage — framing', () => {
  it('links the other challenge sections', () => {
    renderStreak();

    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('href', '/challenge');
    expect(screen.getByRole('link', { name: 'Books' })).toHaveAttribute('href', '/challenge/books');
  });

  it('drops the day counter once the challenge has closed', () => {
    vi.setSystemTime(new Date(2027, 0, 5, 12));
    renderStreak();

    expect(screen.getByText('All 100 days, and how each one went.')).toBeInTheDocument();
  });
});
