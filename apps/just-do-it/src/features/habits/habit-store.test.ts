import { beforeEach, describe, expect, it } from 'vitest';

import { getInitialHabitCompletions, getInitialHabits } from './habit-data';
import { useHabitStore } from './habit-store';

describe('useHabitStore', () => {
  beforeEach(() => {
    useHabitStore.setState({
      habits: getInitialHabits(),
      completions: getInitialHabitCompletions(),
    });
  });

  it('adds a completion for a day that has none', () => {
    const { toggleHabitCompletionOn } = useHabitStore.getState();
    toggleHabitCompletionOn('reading', '2026-08-09');

    const { completions } = useHabitStore.getState();
    expect(
      completions.filter(
        (completion) => completion.habitId === 'reading' && completion.date === '2026-08-09',
      ),
    ).toHaveLength(1);
  });

  it('removes an existing completion instead of duplicating it', () => {
    const { toggleHabitCompletionOn } = useHabitStore.getState();
    toggleHabitCompletionOn('reading', '2026-08-18');

    const { completions } = useHabitStore.getState();
    expect(
      completions.some(
        (completion) => completion.habitId === 'reading' && completion.date === '2026-08-18',
      ),
    ).toBe(false);
  });

  it('is idempotent across a toggle pair', () => {
    const before = useHabitStore.getState().completions.length;
    const { toggleHabitCompletionOn } = useHabitStore.getState();

    toggleHabitCompletionOn('reading', '2026-08-09');
    toggleHabitCompletionOn('reading', '2026-08-09');

    expect(useHabitStore.getState().completions).toHaveLength(before);
  });

  it('ignores an unknown habit', () => {
    const before = useHabitStore.getState().completions.length;
    useHabitStore.getState().toggleHabitCompletionOn('no-such-habit', '2026-08-18');

    expect(useHabitStore.getState().completions).toHaveLength(before);
  });

  it('adds a habit and returns its id', () => {
    const habitId = useHabitStore.getState().addHabit({
      label: 'Stretching',
      frequency: 'daily',
      target: 1,
    });

    expect(useHabitStore.getState().habits.some((habit) => habit.id === habitId)).toBe(true);
  });

  it('updates a habit in place', () => {
    useHabitStore.getState().updateHabit('workout', { target: 5 });

    const updatedHabit = useHabitStore.getState().habits.find((habit) => habit.id === 'workout');
    expect(updatedHabit?.target).toBe(5);
  });

  it('normalizes target to 1 when a habit is switched to daily', () => {
    expect(() =>
      useHabitStore.getState().updateHabit('workout', { frequency: 'daily' }),
    ).not.toThrow();

    const updatedHabit = useHabitStore.getState().habits.find((habit) => habit.id === 'workout');
    expect(updatedHabit?.frequency).toBe('daily');
    expect(updatedHabit?.target).toBe(1);
  });

  it('preserves the original createdAt when a habit is updated', () => {
    const originalHabit = useHabitStore.getState().habits.find((habit) => habit.id === 'workout');

    useHabitStore.getState().updateHabit('workout', { label: 'Evening workout' });

    const updatedHabit = useHabitStore.getState().habits.find((habit) => habit.id === 'workout');
    expect(updatedHabit?.createdAt).toBe(originalHabit?.createdAt);
  });

  it('removes a habit and cascades to its completions', () => {
    useHabitStore.getState().removeHabit('reading');

    const { completions, habits } = useHabitStore.getState();
    expect(habits.some((habit) => habit.id === 'reading')).toBe(false);
    expect(completions.some((completion) => completion.habitId === 'reading')).toBe(false);
  });
});
