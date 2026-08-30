// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useHabitStore } from '../features/habits';
import { HabitsPage } from './habits-page';

// Sunday 16 August 2026, midday — the same clock the Today tests use, and
// inside the fixtures' window. On this day exactly one of the four fixture
// habits (Reading) is checked in, which is what makes the "1/4" summary and
// the split between pressed and unpressed check-in buttons meaningful.
// `HabitsPage` reads `new Date()` on render, so the clock has to be pinned.
const pinnedNow = new Date(2026, 7, 16, 12, 0, 0);

function renderHabits() {
  return render(
    <MemoryRouter>
      <HabitsPage />
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

describe('HabitsPage — the list', () => {
  it('links every tracked habit to its detail route', () => {
    renderHabits();

    for (const label of ['Reading', 'Meditation', 'Workout', 'Language practice']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('counts how many habits are checked in today', () => {
    renderHabits();

    expect(screen.getByText('1/4')).toBeInTheDocument();
  });

  it('separates the habit checked in today from the ones that are not', () => {
    renderHabits();

    expect(
      screen.getByRole('button', { name: 'Mark Reading incomplete for today' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'Mark Meditation complete for today' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('HabitsPage — checking in', () => {
  it('relabels the button and moves the daily count', async () => {
    const user = setUpUser();
    renderHabits();

    await user.click(screen.getByRole('button', { name: 'Mark Meditation complete for today' }));

    expect(
      screen.getByRole('button', { name: 'Mark Meditation incomplete for today' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('2/4')).toBeInTheDocument();
  });

  it('checks a habit back out again', async () => {
    const user = setUpUser();
    renderHabits();

    await user.click(screen.getByRole('button', { name: 'Mark Reading incomplete for today' }));

    expect(screen.getByRole('button', { name: 'Mark Reading complete for today' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByText('0/4')).toBeInTheDocument();
  });
});

describe('HabitsPage — the composer', () => {
  it('starts on daily, and daily habits need no weekly target', () => {
    renderHabits();

    expect(screen.getByRole('button', { name: 'Daily' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByLabelText('Target per week')).not.toBeInTheDocument();
  });

  it('reveals the weekly target only once weekly is chosen', async () => {
    const user = setUpUser();
    renderHabits();

    await user.click(screen.getByRole('button', { name: 'Weekly' }));

    expect(screen.getByRole('button', { name: 'Weekly' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Target per week')).toBeInTheDocument();
  });

  it('adds a daily habit to the list, with a target of one', async () => {
    const user = setUpUser();
    renderHabits();

    await user.type(screen.getByLabelText('Habit name'), 'Drink water');
    await user.click(screen.getByRole('button', { name: 'Add habit' }));

    expect(screen.getByRole('link', { name: 'Drink water' })).toBeInTheDocument();

    const created = useHabitStore.getState().habits.find((habit) => habit.label === 'Drink water');

    expect(created).toMatchObject({ frequency: 'daily', target: 1 });
  });

  // The weekly target is the one field this file sets with `fireEvent.change`
  // instead of user-event, and the reason is a jsdom limitation rather than a
  // preference: jsdom does not support text selection on `type="number"`
  // inputs, so neither `{selectall}` nor `user.clear()` can replace the
  // contents. Typing appends instead — with the default of 3 already there,
  // `type('2')` yields 32, which `clampWeeklyTarget` pins to the maximum of 7.
  // `fireEvent.change` models the end state a real user reaches by selecting
  // the field and typing over it.
  //
  // Worth knowing separately: `clampWeeklyTarget('')` returns 1, so the field
  // cannot be emptied — it snaps to 1 the moment it is cleared. That is real
  // behaviour, not a test artefact. See the plan's debt list.
  it('carries the chosen weekly target onto the new habit', async () => {
    const user = setUpUser();
    renderHabits();

    await user.type(screen.getByLabelText('Habit name'), 'Swim');
    await user.click(screen.getByRole('button', { name: 'Weekly' }));
    fireEvent.change(screen.getByLabelText('Target per week'), { target: { value: '2' } });
    await user.click(screen.getByRole('button', { name: 'Add habit' }));

    const created = useHabitStore.getState().habits.find((habit) => habit.label === 'Swim');

    expect(created).toMatchObject({ frequency: 'weekly', target: 2 });
  });

  // Pins the clamp itself, since the composer is where a bad target would
  // otherwise reach the store. 9 exceeds the maximum of 7.
  it('clamps a weekly target above the maximum', async () => {
    const user = setUpUser();
    renderHabits();

    await user.type(screen.getByLabelText('Habit name'), 'Stretch');
    await user.click(screen.getByRole('button', { name: 'Weekly' }));
    fireEvent.change(screen.getByLabelText('Target per week'), { target: { value: '9' } });
    await user.click(screen.getByRole('button', { name: 'Add habit' }));

    const created = useHabitStore.getState().habits.find((habit) => habit.label === 'Stretch');

    expect(created).toMatchObject({ frequency: 'weekly', target: 7 });
  });

  it('snaps an emptied weekly target back to one rather than leaving it blank', async () => {
    const user = setUpUser();
    renderHabits();

    await user.click(screen.getByRole('button', { name: 'Weekly' }));
    fireEvent.change(screen.getByLabelText('Target per week'), { target: { value: '' } });

    expect(screen.getByLabelText('Target per week')).toHaveValue(1);
  });

  it('clears the name field after adding, ready for the next one', async () => {
    const user = setUpUser();
    renderHabits();

    await user.type(screen.getByLabelText('Habit name'), 'Drink water');
    await user.click(screen.getByRole('button', { name: 'Add habit' }));

    expect(screen.getByLabelText('Habit name')).toHaveValue('');
  });

  // `habitSchema` requires a non-empty label, so a whitespace-only name throws
  // if it reaches the store rather than being written. "No habit was added" is
  // therefore true both when the composer declines it and when it blows up, and
  // the count assertion alone cannot tell those apart. The window `error`
  // listener can: an exception escaping a React event handler surfaces there,
  // and vitest reports it without failing the test that caused it.
  it('refuses a name that is only whitespace, without throwing', async () => {
    const user = setUpUser();
    const countBefore = useHabitStore.getState().habits.length;
    const uncaught: string[] = [];
    const recordError = (event: ErrorEvent) => {
      uncaught.push(String(event.error ?? event.message));
    };
    window.addEventListener('error', recordError);

    try {
      renderHabits();

      await user.type(screen.getByLabelText('Habit name'), '   ');
      await user.click(screen.getByRole('button', { name: 'Add habit' }));

      expect(useHabitStore.getState().habits).toHaveLength(countBefore);
      expect(uncaught).toEqual([]);
    } finally {
      window.removeEventListener('error', recordError);
    }
  });
});
