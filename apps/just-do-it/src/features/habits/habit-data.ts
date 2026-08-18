import { z } from 'zod';

import habitCompletionsFixture from '../../data/habit-completions.json';
import habitsFixture from '../../data/habits.json';
import { HABIT_FREQUENCY_VALUES, type Habit, type HabitCompletion } from './types';

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : undefined;
}

const habitDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a calendar date in YYYY-MM-DD form');

export const habitSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().trim().min(1),
    description: z.preprocess(normalizeOptionalText, z.string().optional()),
    frequency: z.enum(HABIT_FREQUENCY_VALUES),
    target: z.number().int().min(1).max(7),
    createdAt: habitDateSchema,
  })
  .refine((habit) => habit.frequency !== 'daily' || habit.target === 1, {
    message: 'A daily habit must have a target of 1',
    path: ['target'],
  });

export const habitListSchema = z.array(habitSchema);

export const habitCompletionSchema = z.object({
  id: z.string().min(1),
  habitId: z.string().min(1),
  date: habitDateSchema,
});

export const habitCompletionCollectionSchema = z
  .array(habitCompletionSchema)
  .superRefine((completions, context) => {
    const seenKeys = new Set<string>();

    completions.forEach((completion, index) => {
      const completionKey = `${completion.habitId}|${completion.date}`;

      if (seenKeys.has(completionKey)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate completion for ${completionKey}`,
          path: [index],
        });
        return;
      }

      seenKeys.add(completionKey);
    });
  });

const validatedHabitFixture = habitListSchema.parse(habitsFixture);
const validatedHabitCompletionFixture =
  habitCompletionCollectionSchema.parse(habitCompletionsFixture);

export function cloneHabit(habit: Habit): Habit {
  return { ...habit };
}

export function cloneHabitCompletion(completion: HabitCompletion): HabitCompletion {
  return { ...completion };
}

export function getInitialHabits(): Habit[] {
  return validatedHabitFixture.map(cloneHabit);
}

export function getInitialHabitCompletions(): HabitCompletion[] {
  return validatedHabitCompletionFixture.map(cloneHabitCompletion);
}

export { validatedHabitCompletionFixture, validatedHabitFixture };
