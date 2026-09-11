// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useJourneyStore } from '../features/journeys';
import { JourneysPage } from './journeys-page';

// Day one of the seeded enrollment, midday. The page reads `new Date()` both
// for each card's progress and to default the start-date field.
const pinnedNow = new Date(2026, 8, 11, 12, 0, 0);

function renderJourneys() {
  return render(
    <MemoryRouter initialEntries={['/journeys']}>
      <Routes>
        <Route path="/journeys" element={<JourneysPage />} />
        <Route path="/journeys/:enrollmentId" element={<p>Journey day page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function setUpUser() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

function runningSection(): HTMLElement {
  return screen.getByRole('region', { name: 'Running' });
}

function availableSection(): HTMLElement {
  return screen.getByRole('region', { name: 'Available' });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(pinnedNow);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('JourneysPage — what is running', () => {
  it('lists the seeded enrollment with the day it is on', () => {
    renderJourneys();

    const running = runningSection();

    expect(
      within(running).getByRole('link', { name: '100-Day Discipline Challenge' }),
    ).toBeInTheDocument();
    expect(within(running).getByText('Day 1/100')).toBeInTheDocument();
  });

  // The window comes from the enrollment's start date plus the journey's
  // length, which is the split the whole model rests on.
  it('shows the window the enrollment actually runs over', () => {
    renderJourneys();

    expect(within(runningSection()).getByText(/11 Sep 2026\s*–\s*19 Dec 2026/)).toBeInTheDocument();
  });

  it('links each running journey to its own day page', () => {
    renderJourneys();

    expect(within(runningSection()).getByRole('link', { name: 'Open' })).toHaveAttribute(
      'href',
      '/journeys/enrollment-discipline',
    );
  });

  it('does not offer a journey that is already running', () => {
    renderJourneys();

    expect(
      within(availableSection()).queryByRole('button', { name: /100-Day Discipline Challenge/ }),
    ).not.toBeInTheDocument();
  });

  it('says so when nothing is running', () => {
    useJourneyStore.getState().leaveJourney('enrollment-discipline');
    renderJourneys();

    expect(within(runningSection()).getByText(/Nothing running yet/)).toBeInTheDocument();
  });
});

describe('JourneysPage — starting a journey', () => {
  it('offers the journey that is not yet running, with its shape', () => {
    renderJourneys();

    const available = availableSection();

    expect(
      within(available).getByRole('heading', { name: '30-Day Deep Work Reset' }),
    ).toBeInTheDocument();
    expect(
      within(available).getByText(/30 days · 3 books · 2-line reflection/),
    ).toBeInTheDocument();
  });

  it('moves a started journey out of available and into running', async () => {
    const user = setUpUser();
    renderJourneys();

    await user.click(screen.getByRole('button', { name: 'Start 30-Day Deep Work Reset' }));

    expect(
      within(runningSection()).getByRole('link', { name: '30-Day Deep Work Reset' }),
    ).toBeInTheDocument();
    expect(
      within(availableSection()).queryByRole('heading', { name: '30-Day Deep Work Reset' }),
    ).not.toBeInTheDocument();
  });

  // The start date is chosen at enrollment time rather than baked into the
  // journey, so the same journey can be run later without disturbing this one.
  it('starts it on the chosen date rather than today', async () => {
    const user = setUpUser();
    renderJourneys();

    fireEvent.change(screen.getByLabelText('Start on'), { target: { value: '2026-10-01' } });
    await user.click(screen.getByRole('button', { name: 'Start 30-Day Deep Work Reset' }));

    expect(
      useJourneyStore.getState().enrollments.find((entry) => entry.journeyId === 'deep-work-reset'),
    ).toMatchObject({ startDate: '2026-10-01' });
  });

  it('defaults the start date to today', () => {
    renderJourneys();

    expect(screen.getByLabelText('Start on')).toHaveValue('2026-09-11');
  });

  it('reports a journey that has not begun as not running', async () => {
    const user = setUpUser();
    renderJourneys();

    fireEvent.change(screen.getByLabelText('Start on'), { target: { value: '2026-12-01' } });
    await user.click(screen.getByRole('button', { name: 'Start 30-Day Deep Work Reset' }));

    expect(within(runningSection()).getByText('Not running')).toBeInTheDocument();
  });
});

describe('JourneysPage — leaving a journey', () => {
  it('removes the enrollment and its history together', async () => {
    const user = setUpUser();
    renderJourneys();

    await user.click(screen.getByRole('button', { name: 'Leave 100-Day Discipline Challenge' }));

    expect(useJourneyStore.getState().enrollments).toHaveLength(0);
    expect(useJourneyStore.getState().completions).toHaveLength(0);
    expect(within(runningSection()).getByText(/Nothing running yet/)).toBeInTheDocument();
  });

  it('puts the journey back on offer afterwards', async () => {
    const user = setUpUser();
    renderJourneys();

    await user.click(screen.getByRole('button', { name: 'Leave 100-Day Discipline Challenge' }));

    expect(
      within(availableSection()).getByRole('heading', { name: '100-Day Discipline Challenge' }),
    ).toBeInTheDocument();
  });
});

describe('JourneysPage — creating a journey', () => {
  it('adds the new journey to the available list', async () => {
    const user = setUpUser();
    renderJourneys();

    await user.type(screen.getByLabelText('Title'), '100 Days to Dex');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(
      within(availableSection()).getByRole('heading', { name: '100 Days to Dex' }),
    ).toBeInTheDocument();
  });

  // jsdom does not support text selection on `type="number"` inputs, so neither
  // `{selectall}` nor `user.clear()` can replace the contents — typing appends.
  // `fireEvent.change` models the end state a real user reaches by selecting the
  // field and typing over it.
  it('carries the chosen length onto the new journey', async () => {
    const user = setUpUser();
    renderJourneys();

    await user.type(screen.getByLabelText('Title'), '100 Days to Dex');
    fireEvent.change(screen.getByLabelText('Days'), { target: { value: '100' } });
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(
      useJourneyStore.getState().journeys.find((entry) => entry.title === '100 Days to Dex'),
    ).toMatchObject({ totalDays: 100 });
  });

  it('can be started straight away', async () => {
    const user = setUpUser();
    renderJourneys();

    await user.type(screen.getByLabelText('Title'), '100 Days to Dex');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await user.click(screen.getByRole('button', { name: 'Start 100 Days to Dex' }));

    expect(
      within(runningSection()).getByRole('link', { name: '100 Days to Dex' }),
    ).toBeInTheDocument();
  });

  it('clears the title field afterwards, ready for the next one', async () => {
    const user = setUpUser();
    renderJourneys();

    await user.type(screen.getByLabelText('Title'), '100 Days to Dex');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(screen.getByLabelText('Title')).toHaveValue('');
  });

  // `journeySchema` requires a non-empty title, so a whitespace-only name throws
  // if it reaches the store rather than being refused. "No journey was added" is
  // therefore true both when the form declines it and when it blows up, and the
  // count assertion alone cannot tell those apart. The window `error` listener
  // can: an exception escaping a React event handler surfaces there.
  it('refuses a title that is only whitespace, without throwing', async () => {
    const user = setUpUser();
    const countBefore = useJourneyStore.getState().journeys.length;
    const uncaught: string[] = [];
    const recordError = (event: ErrorEvent) => {
      uncaught.push(String(event.error ?? event.message));
    };
    window.addEventListener('error', recordError);

    try {
      renderJourneys();

      await user.type(screen.getByLabelText('Title'), '   ');
      await user.click(screen.getByRole('button', { name: 'Create' }));

      expect(useJourneyStore.getState().journeys).toHaveLength(countBefore);
      expect(uncaught).toEqual([]);
    } finally {
      window.removeEventListener('error', recordError);
    }
  });
});
