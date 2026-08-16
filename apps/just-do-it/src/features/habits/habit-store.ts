import { create } from 'zustand'

import { getInitialHabits, habitSchema } from './habit-data'
import { HABIT_DAY_COUNT, type Habit } from './types'

type HabitStoreState = {
  habits: Habit[]
  setHabitCompletion: (habitId: string, dayIndex: number, complete: boolean) => void
  toggleHabitCompletion: (habitId: string, dayIndex: number) => void
}

function isDayIndex(dayIndex: number): boolean {
  return dayIndex >= 0 && dayIndex < HABIT_DAY_COUNT
}

function buildHabitRecord(habit: Habit, dayIndex: number, complete: boolean): Habit {
  const nextDays = [...habit.days]
  nextDays[dayIndex] = complete

  return habitSchema.parse({
    ...habit,
    days: nextDays,
  })
}

export const useHabitStore = create<HabitStoreState>()((set) => ({
  habits: getInitialHabits(),
  setHabitCompletion: (habitId, dayIndex, complete) => {
    if (!isDayIndex(dayIndex)) return

    set((state) => ({
      habits: state.habits.map((habit) =>
        habit.id === habitId ? buildHabitRecord(habit, dayIndex, complete) : habit,
      ),
    }))
  },
  toggleHabitCompletion: (habitId, dayIndex) => {
    if (!isDayIndex(dayIndex)) return

    set((state) => ({
      habits: state.habits.map((habit) =>
        habit.id === habitId ? buildHabitRecord(habit, dayIndex, !habit.days[dayIndex]) : habit,
      ),
    }))
  },
}))
