import { useHabitStore } from './habit-store';

export function useHabits() {
  return useHabitStore((state) => state.habits);
}

export function useSetHabitCompletion() {
  return useHabitStore((state) => state.setHabitCompletion);
}

export function useToggleHabitCompletion() {
  return useHabitStore((state) => state.toggleHabitCompletion);
}
