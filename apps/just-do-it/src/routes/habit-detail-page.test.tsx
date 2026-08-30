// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useHabitStore } from '../features/habits';
import { HabitDetailPage } from './habit-detail-page';

// Sunday 16 August 2026, midday — the clock the other route suites use. On this
// day the Reading habit is checked in and the other three are not.
const pinnedNow = new Date(2026, 7, 16, 12, 0, 0);

// The first test in the repo to mount a real router rather than a bare
// `MemoryRouter`: this route reads `:habitId` through `useParams`, so the path
// has to be matched for the page to resolve a habit at all. The `/habits` stub
// stands in for the list page so that navigation after a delete is observable
// without pulling a second route's rendering into this file.
function renderHabitDetail(habitId: string) {
  return render(
    <MemoryRouter initialEntries={[`/habits/${habitId}`]}>
      <Routes>
        <Route element={<HabitDetailPage />} path="/habits/:habitId" />
        <Route element={<h1>Habits list</h1>} path="/habits" />
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

describe('HabitDetailPage — resolving the route parameter', () => {
  // The description is asserted through the edit field rather than `getByText`,
  // because the page renders it twice — once as the header paragraph and once
  // as the textarea's contents, which text queries also match.
  it('renders the habit named in the path', () => {
    renderHabitDetail('reading');

    expect(screen.getByRole('heading', { level: 1, name: 'Reading' })).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toHaveValue('Twenty pages before bed, every day.');
    expect(screen.getByRole('button', { name: 'Daily' })).toHaveAttribute('aria-pressed', 'true');
  });

  // The companion to the test above: without it, a page that ignored the
  // parameter and always rendered the first habit would still pass. Workout is
  // also weekly where Reading is daily, so this pins the frequency too.
  it('renders a different habit for a different path', () => {
    renderHabitDetail('workout');

    expect(screen.getByRole('heading', { level: 1, name: 'Workout' })).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toHaveValue(
      'Four sessions a week, whichever days fit.',
    );
    expect(screen.getByRole('button', { name: 'Weekly' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('falls back to a not-found card for an unknown habit', () => {
    renderHabitDetail('does-not-exist');

    expect(screen.getByRole('heading', { name: 'Habit not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to habits' })).toBeInTheDocument();
  });
});

describe('HabitDetailPage — checking in', () => {
  it('opens showing today already checked in', () => {
    renderHabitDetail('reading');

    expect(
      screen.getByRole('button', { name: 'Mark Reading incomplete for today' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('checks the habit back out', async () => {
    const user = setUpUser();
    renderHabitDetail('reading');

    await user.click(screen.getByRole('button', { name: 'Mark Reading incomplete for today' }));

    expect(screen.getByRole('button', { name: 'Mark Reading complete for today' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('checks in a habit that was not yet done today', async () => {
    const user = setUpUser();
    renderHabitDetail('meditation');

    await user.click(screen.getByRole('button', { name: 'Mark Meditation complete for today' }));

    expect(
      screen.getByRole('button', { name: 'Mark Meditation incomplete for today' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('HabitDetailPage — editing', () => {
  it('prefills the form from the habit', () => {
    renderHabitDetail('reading');

    expect(screen.getByLabelText('Name')).toHaveValue('Reading');
    expect(screen.getByLabelText('Description')).toHaveValue('Twenty pages before bed, every day.');
    expect(screen.getByRole('button', { name: 'Daily' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('cannot be saved until something actually changes', () => {
    renderHabitDetail('reading');

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('enables saving once the name differs', async () => {
    const user = setUpUser();
    renderHabitDetail('reading');

    await user.type(screen.getByLabelText('Name'), ' nightly');

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  it('writes the edited name to the store and to the page title', async () => {
    const user = setUpUser();
    renderHabitDetail('reading');

    await user.type(screen.getByLabelText('Name'), ' nightly');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Reading nightly' })).toBeInTheDocument();
    expect(useHabitStore.getState().habits.find((habit) => habit.id === 'reading')).toMatchObject({
      label: 'Reading nightly',
    });
  });

  it('reveals the weekly target when the frequency is switched', async () => {
    const user = setUpUser();
    renderHabitDetail('reading');

    expect(screen.queryByLabelText('Target per week')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Weekly' }));

    expect(screen.getByLabelText('Target per week')).toBeInTheDocument();
  });

  // Switching a weekly habit to daily has to reset the target rather than carry
  // the old weekly one across — `habitSchema` refuses a daily habit whose
  // target is anything but 1. Note where that is actually enforced: the route
  // passes `draftFrequency === 'daily' ? 1 : draftTarget`, but `buildHabitRecord`
  // normalizes the same way, so the route's ternary is belt-and-braces and
  // removing it changes nothing. This test therefore pins the outcome, not that
  // particular line.
  it('resets the target to one when a weekly habit becomes daily', async () => {
    const user = setUpUser();
    renderHabitDetail('workout');

    await user.click(screen.getByRole('button', { name: 'Daily' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(useHabitStore.getState().habits.find((habit) => habit.id === 'workout')).toMatchObject({
      frequency: 'daily',
      target: 1,
    });
  });
});

describe('HabitDetailPage — deleting', () => {
  it('removes the habit and returns to the list', async () => {
    const user = setUpUser();
    renderHabitDetail('reading');

    await user.click(screen.getByRole('button', { name: 'Delete habit' }));

    expect(screen.getByRole('heading', { name: 'Habits list' })).toBeInTheDocument();
    expect(useHabitStore.getState().habits.some((habit) => habit.id === 'reading')).toBe(false);
  });
});
