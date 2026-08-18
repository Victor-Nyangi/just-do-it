export const HABIT_FREQUENCY_VALUES = ['daily', 'weekly'] as const;

export type HabitFrequency = (typeof HABIT_FREQUENCY_VALUES)[number];

export type Habit = {
  id: string;
  label: string;
  description?: string;
  frequency: HabitFrequency;
  target: number;
  createdAt: string;
};

export type HabitCompletion = {
  id: string;
  habitId: string;
  date: string;
};

export type HabitInput = {
  label: string;
  description?: string;
  frequency: HabitFrequency;
  target: number;
};

export type HabitUpdateInput = Partial<
  Pick<Habit, 'label' | 'description' | 'frequency' | 'target'>
>;
