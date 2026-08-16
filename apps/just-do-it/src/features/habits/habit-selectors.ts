import type { Habit } from './types'

export function selectHabitCompletionCount(habit: Habit): number {
  return habit.days.filter(Boolean).length
}
