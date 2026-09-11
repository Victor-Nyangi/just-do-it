// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useChallengeStore } from '../features/challenge';
import { ChallengePage } from './challenge-page';

// Friday 11 September 2026, midday — day one of the challenge, and midday
// rather than midnight so the clock creeping forward under
// `shouldAdvanceTime` cannot roll the date over. `ChallengePage` reads
// `new Date()` on render, so the clock has to be pinned.
//
// Day one carries five activities, two of which the fixture has already
// completed: the walk and the technical reading.
const pinnedNow = new Date(2026, 8, 11, 12, 0, 0);

function renderChallenge() {
  return render(
    <MemoryRouter>
      <ChallengePage />
    </MemoryRouter>,
  );
}

function setUpUser() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(pinnedNow);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ChallengePage — the day', () => {
  it('counts the day out of the hundred', () => {
    renderChallenge();

    expect(screen.getByRole('heading', { level: 1, name: 'Day 1 of 100' })).toBeInTheDocument();
  });

  it('names the date in full', () => {
    renderChallenge();

    expect(screen.getByText('Friday, 11 September 2026')).toBeInTheDocument();
  });

  it('shows how much of the day is done', () => {
    renderChallenge();

    expect(screen.getByText('2 of 5 done')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Day 1 progress' })).toHaveAttribute(
      'aria-valuenow',
      '40',
    );
  });

  it('links the other challenge sections', () => {
    renderChallenge();

    expect(screen.getByRole('link', { name: 'Books' })).toHaveAttribute('href', '/challenge/books');
    expect(screen.getByRole('link', { name: 'Streak' })).toHaveAttribute(
      'href',
      '/challenge/streak',
    );
  });
});

describe('ChallengePage — the checklist', () => {
  it('groups the day into its four categories', () => {
    renderChallenge();

    for (const category of ['Physical', 'Technical reading', 'Growth reading', 'Reflection']) {
      expect(screen.getByRole('heading', { name: category })).toBeInTheDocument();
    }
  });

  it('offers the rotation the day actually calls for', () => {
    renderChallenge();

    expect(
      screen.getByRole('button', { name: 'Mark Walk 1 km incomplete for day 1' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Mark 50 push-ups complete for day 1' }),
    ).toBeInTheDocument();
    // Day one's rotation does not include the run.
    expect(screen.queryByRole('button', { name: /10 minute run/ })).not.toBeInTheDocument();
  });

  it('separates what is done from what is not', () => {
    renderChallenge();

    expect(
      screen.getByRole('button', { name: 'Mark Walk 1 km incomplete for day 1' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'Mark Daily reflection complete for day 1' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('names the books the day rotated onto', () => {
    renderChallenge();

    expect(screen.getByRole('button', { name: /Micro Frontends in Action/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Man's Search for Meaning/ })).toBeInTheDocument();
  });
});

describe('ChallengePage — ticking an activity', () => {
  it('relabels the activity and moves the count', async () => {
    const user = setUpUser();
    renderChallenge();

    await user.click(
      screen.getByRole('button', { name: 'Mark Daily reflection complete for day 1' }),
    );

    expect(
      screen.getByRole('button', { name: 'Mark Daily reflection incomplete for day 1' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('3 of 5 done')).toBeInTheDocument();
  });

  it('unticks one that was already done', async () => {
    const user = setUpUser();
    renderChallenge();

    await user.click(screen.getByRole('button', { name: 'Mark Walk 1 km incomplete for day 1' }));

    expect(screen.getByText('1 of 5 done')).toBeInTheDocument();
  });

  it('writes the completion through to the store', async () => {
    const user = setUpUser();
    renderChallenge();

    await user.click(
      screen.getByRole('button', { name: 'Mark Daily reflection complete for day 1' }),
    );

    expect(
      useChallengeStore
        .getState()
        .completions.some((completion) => completion.activityId === 'day-1-reflection'),
    ).toBe(true);
  });

  it('calls the day complete once nothing is left', async () => {
    const user = setUpUser();
    renderChallenge();

    for (const name of [
      'Mark 50 push-ups complete for day 1',
      "Mark Man's Search for Meaning complete for day 1",
      'Mark Daily reflection complete for day 1',
    ]) {
      await user.click(screen.getByRole('button', { name }));
    }

    expect(screen.getByText('Day complete')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Day 1 progress' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
  });
});

describe('ChallengePage — moving between days', () => {
  it('cannot go back past day one', () => {
    renderChallenge();

    expect(screen.getByRole('button', { name: 'Go to the previous day' })).toBeDisabled();
  });

  it('steps forward to the next day and its own rotation', async () => {
    const user = setUpUser();
    renderChallenge();

    await user.click(screen.getByRole('button', { name: 'Go to the next day' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Day 2 of 100' })).toBeInTheDocument();
    expect(screen.getByText('Saturday, 12 September 2026')).toBeInTheDocument();
    // Day two's rotation swaps the walk for the run.
    expect(
      screen.getByRole('button', { name: 'Mark 10 minute run complete for day 2' }),
    ).toBeInTheDocument();
  });

  it('starts another day from nothing done', async () => {
    const user = setUpUser();
    renderChallenge();

    await user.click(screen.getByRole('button', { name: 'Go to the next day' }));

    expect(screen.getByText('0 of 5 done')).toBeInTheDocument();
  });

  it('offers a way back to today only once it has been left', async () => {
    const user = setUpUser();
    renderChallenge();

    expect(screen.queryByRole('button', { name: 'Back to today' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Go to the next day' }));
    expect(screen.getByRole('button', { name: 'Back to today' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back to today' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Day 1 of 100' })).toBeInTheDocument();
  });
});

describe('ChallengePage — outside the window', () => {
  it('opens on day one and says the challenge has not started', () => {
    vi.setSystemTime(new Date(2026, 7, 1, 12));
    renderChallenge();

    expect(screen.getByRole('heading', { level: 1, name: 'Day 1 of 100' })).toBeInTheDocument();
    expect(
      screen.getByText(/The challenge opens on Friday, 11 September 2026/),
    ).toBeInTheDocument();
  });

  it('opens on the last day once the challenge has closed', () => {
    vi.setSystemTime(new Date(2027, 0, 5, 12));
    renderChallenge();

    expect(screen.getByRole('heading', { level: 1, name: 'Day 100 of 100' })).toBeInTheDocument();
    expect(
      screen.getByText(/The challenge closed on Saturday, 19 December 2026/),
    ).toBeInTheDocument();
  });
});
