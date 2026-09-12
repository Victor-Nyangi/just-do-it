// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useJourneyStore } from '../features/journeys';
import { JourneyDayPage } from './journey-day-page';

// Friday 11 September 2026, midday — day one of the seeded enrollment, and
// midday rather than midnight so the clock creeping forward under
// `shouldAdvanceTime` cannot roll the date over. The page reads `new Date()` on
// render, so the clock has to be pinned.
//
// Day one carries five activities, two of which the fixture has already
// completed: the walk and the technical reading.
const pinnedNow = new Date(2026, 8, 12, 12, 0, 0);
const ENROLLMENT_ID = 'enrollment-discipline';

// The route takes a dynamic segment, so it has to be mounted through
// Routes/Route with initialEntries — a bare MemoryRouter resolves no params.
function renderDay(enrollmentId = ENROLLMENT_ID) {
  return render(
    <MemoryRouter initialEntries={[`/journeys/${enrollmentId}`]}>
      <Routes>
        <Route path="/journeys/:enrollmentId" element={<JourneyDayPage />} />
        <Route path="/journeys" element={<p>Journeys list</p>} />
      </Routes>
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

describe('JourneyDayPage — the day', () => {
  it('names the journey and counts the day out of its length', () => {
    renderDay();

    expect(screen.getByText('100-Day Discipline Challenge')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Day 1 of 100' })).toBeInTheDocument();
  });

  it('names the date in full', () => {
    renderDay();

    expect(screen.getByText('Saturday, 12 September 2026')).toBeInTheDocument();
  });

  it('shows how much of the day is done', () => {
    renderDay();

    expect(screen.getByText('2 of 5 done')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Day 1 progress' })).toHaveAttribute(
      'aria-valuenow',
      '40',
    );
  });

  it('scopes its section links to the enrollment', () => {
    renderDay();

    expect(screen.getByRole('link', { name: 'Books' })).toHaveAttribute(
      'href',
      `/journeys/${ENROLLMENT_ID}/books`,
    );
    expect(screen.getByRole('link', { name: 'All journeys' })).toHaveAttribute('href', '/journeys');
  });
});

describe('JourneyDayPage — the checklist', () => {
  it('groups the day into its four categories', () => {
    renderDay();

    for (const category of ['Physical', 'Technical reading', 'Growth reading', 'Reflection']) {
      expect(screen.getByRole('heading', { name: category })).toBeInTheDocument();
    }
  });

  it('offers the rotation the day actually calls for', () => {
    renderDay();

    expect(
      screen.getByRole('button', { name: 'Mark Walk 1 km incomplete for day 1' }),
    ).toBeInTheDocument();
    // Day one's rotation does not include the run.
    expect(screen.queryByRole('button', { name: /10 minute run/ })).not.toBeInTheDocument();
  });

  it('separates what is done from what is not', () => {
    renderDay();

    expect(
      screen.getByRole('button', { name: 'Mark Walk 1 km incomplete for day 1' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'Mark Daily reflection complete for day 1' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('JourneyDayPage — ticking an activity', () => {
  it('relabels the activity and moves the count', async () => {
    const user = setUpUser();
    renderDay();

    await user.click(
      screen.getByRole('button', { name: 'Mark Daily reflection complete for day 1' }),
    );

    expect(
      screen.getByRole('button', { name: 'Mark Daily reflection incomplete for day 1' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('3 of 5 done')).toBeInTheDocument();
  });

  it('writes the completion through to the store against its enrollment', async () => {
    const user = setUpUser();
    renderDay();

    await user.click(
      screen.getByRole('button', { name: 'Mark Daily reflection complete for day 1' }),
    );

    expect(
      useJourneyStore
        .getState()
        .completions.find((completion) => completion.activityId === 'day-1-reflection'),
    ).toMatchObject({ enrollmentId: ENROLLMENT_ID });
  });

  it('calls the day complete once nothing is left', async () => {
    const user = setUpUser();
    renderDay();

    for (const name of [
      'Mark 50 push-ups complete for day 1',
      "Mark Man's Search for Meaning complete for day 1",
      'Mark Daily reflection complete for day 1',
    ]) {
      await user.click(screen.getByRole('button', { name }));
    }

    expect(screen.getByText('Day complete')).toBeInTheDocument();
  });
});

describe('JourneyDayPage — moving between days', () => {
  it('cannot go back past day one', () => {
    renderDay();

    expect(screen.getByRole('button', { name: 'Go to the previous day' })).toBeDisabled();
  });

  it('steps forward to the next day and its own rotation', async () => {
    const user = setUpUser();
    renderDay();

    await user.click(screen.getByRole('button', { name: 'Go to the next day' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Day 2 of 100' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Mark 10 minute run complete for day 2' }),
    ).toBeInTheDocument();
    expect(screen.getByText('0 of 5 done')).toBeInTheDocument();
  });

  it('offers a way back to today only once it has been left', async () => {
    const user = setUpUser();
    renderDay();

    expect(screen.queryByRole('button', { name: 'Back to today' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Go to the next day' }));
    await user.click(screen.getByRole('button', { name: 'Back to today' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Day 1 of 100' })).toBeInTheDocument();
  });
});

describe('JourneyDayPage — another journey entirely', () => {
  // The reading-only journey proves the page is driven by the definition rather
  // than by the shape the discipline challenge happens to have.
  it('renders a journey with no physical work and one reading track', () => {
    const enrollmentId = useJourneyStore
      .getState()
      .enrollInJourney('deep-work-reset', '2026-09-12');

    if (!enrollmentId) throw new Error('Expected an enrollment');

    renderDay(enrollmentId);

    expect(screen.getByRole('heading', { level: 1, name: 'Day 1 of 30' })).toBeInTheDocument();
    expect(screen.getByText('0 of 2 done')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Physical' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Growth reading' })).not.toBeInTheDocument();
  });
});

describe('JourneyDayPage — outside the window', () => {
  it('opens on day one and says the journey has not started', () => {
    vi.setSystemTime(new Date(2026, 7, 1, 12));
    renderDay();

    expect(screen.getByRole('heading', { level: 1, name: 'Day 1 of 100' })).toBeInTheDocument();
    expect(screen.getByText(/opens on Saturday, 12 September 2026/)).toBeInTheDocument();
  });

  it('opens on the last day once the journey has closed', () => {
    vi.setSystemTime(new Date(2027, 0, 5, 12));
    renderDay();

    expect(screen.getByRole('heading', { level: 1, name: 'Day 100 of 100' })).toBeInTheDocument();
    expect(screen.getByText(/closed on Sunday, 20 December 2026/)).toBeInTheDocument();
  });

  // Reachable by editing the URL, and by leaving a journey while looking at it.
  it('explains itself when the enrollment does not exist', () => {
    renderDay('nope');

    expect(
      screen.getByRole('heading', { name: 'This journey is not in your list' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse journeys' })).toHaveAttribute(
      'href',
      '/journeys',
    );
  });
});
