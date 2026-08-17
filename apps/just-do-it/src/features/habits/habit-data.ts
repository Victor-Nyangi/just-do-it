import { z } from 'zod';

import habitsFixture from '../../data/habits.json';
import { HABIT_DAY_COUNT, type Habit } from './types';

const habitDaysSchema = z.array(z.boolean()).length(HABIT_DAY_COUNT);

export const habitSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1),
  days: habitDaysSchema,
});

export const habitListSchema = z.array(habitSchema);

const validatedHabitFixture = habitListSchema.parse(habitsFixture);

export function cloneHabit(habit: Habit): Habit {
  return {
    ...habit,
    days: [...habit.days],
  };
}

export function getInitialHabits(): Habit[] {
  return validatedHabitFixture.map(cloneHabit);
}

export { validatedHabitFixture };
