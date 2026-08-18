import { validatedBookFixture } from '../features/books';
import { validatedGoalData } from '../features/goals';
import { validatedHabitCompletionFixture, validatedHabitFixture } from '../features/habits';
import { validatedListFixture } from '../features/lists';
import { validatedTaskFixture } from '../features/tasks';

export const dashboardData = {
  tasks: validatedTaskFixture,
  habits: validatedHabitFixture,
  habitCompletions: validatedHabitCompletionFixture,
  goal: validatedGoalData[0],
};

export const staticData = {
  books: validatedBookFixture,
  lists: validatedListFixture,
};
