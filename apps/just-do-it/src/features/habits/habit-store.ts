import { create } from 'zustand';

import {
  getInitialHabitCompletions,
  getInitialHabits,
  habitCompletionSchema,
  habitSchema,
} from './habit-data';
import { toHabitDateKey } from './habit-selectors';
import type { Habit, HabitCompletion, HabitInput, HabitUpdateInput } from './types';

type HabitStoreState = {
  habits: Habit[];
  completions: HabitCompletion[];
  toggleHabitCompletionOn: (habitId: string, dateKey: string) => void;
  addHabit: (input: HabitInput) => string;
  updateHabit: (habitId: string, input: HabitUpdateInput) => void;
  removeHabit: (habitId: string) => void;
};

function buildHabitRecord(habitId: string, input: HabitUpdateInput, existingHabit?: Habit): Habit {
  const frequency = input.frequency ?? existingHabit?.frequency ?? 'daily';
  const requestedTarget = input.target ?? existingHabit?.target ?? 1;

  return habitSchema.parse({
    id: existingHabit?.id ?? habitId,
    label: input.label ?? existingHabit?.label,
    // `in` rather than `??` so an explicit undefined clears the description.
    // With `??`, blanking the field sent undefined and restored the old text.
    description: 'description' in input ? input.description : existingHabit?.description,
    frequency,
    // The schema refuses a daily habit with any other target; normalize rather than throw.
    target: frequency === 'daily' ? 1 : requestedTarget,
    createdAt: existingHabit?.createdAt ?? toHabitDateKey(new Date()),
  });
}

function buildHabitCompletionRecord(
  completionId: string,
  habitId: string,
  dateKey: string,
): HabitCompletion {
  return habitCompletionSchema.parse({ id: completionId, habitId, date: dateKey });
}

export const useHabitStore = create<HabitStoreState>()((set) => ({
  habits: getInitialHabits(),
  completions: getInitialHabitCompletions(),
  toggleHabitCompletionOn: (habitId, dateKey) => {
    set((state) => {
      if (!state.habits.some((habit) => habit.id === habitId)) return state;

      const existingCompletion = state.completions.find(
        (completion) => completion.habitId === habitId && completion.date === dateKey,
      );

      if (existingCompletion) {
        return {
          completions: state.completions.filter(
            (completion) => completion.id !== existingCompletion.id,
          ),
        };
      }

      return {
        completions: [
          ...state.completions,
          buildHabitCompletionRecord(crypto.randomUUID(), habitId, dateKey),
        ],
      };
    });
  },
  addHabit: (input) => {
    const habitId = crypto.randomUUID();

    set((state) => ({
      habits: [...state.habits, buildHabitRecord(habitId, input)],
    }));

    return habitId;
  },
  updateHabit: (habitId, input) => {
    set((state) => ({
      habits: state.habits.map((habit) =>
        habit.id === habitId ? buildHabitRecord(habitId, input, habit) : habit,
      ),
    }));
  },
  removeHabit: (habitId) => {
    set((state) => ({
      habits: state.habits.filter((habit) => habit.id !== habitId),
      completions: state.completions.filter((completion) => completion.habitId !== habitId),
    }));
  },
}));
