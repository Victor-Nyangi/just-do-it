import { useHabitStore } from './habit-store';
import type { Habit } from './types';

export function useHabits() {
  return useHabitStore((state) => state.habits);
}

export function useHabitCompletions() {
  return useHabitStore((state) => state.completions);
}

export function useHabitById(habitId: string): Habit | null {
  return useHabitStore((state) => state.habits.find((habit) => habit.id === habitId) ?? null);
}

export function useToggleHabitCompletion() {
  return useHabitStore((state) => state.toggleHabitCompletionOn);
}

export function useAddHabit() {
  return useHabitStore((state) => state.addHabit);
}

export function useUpdateHabit() {
  return useHabitStore((state) => state.updateHabit);
}

export function useRemoveHabit() {
  return useHabitStore((state) => state.removeHabit);
}
