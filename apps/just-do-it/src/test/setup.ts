import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

import { getInitialBooks, useBookStore } from '../features/books';
import { getInitialGoals, useGoalStore } from '../features/goals';
import { getInitialHabitCompletions, getInitialHabits, useHabitStore } from '../features/habits';
import { getInitialLists, useListStore } from '../features/lists';
import { getInitialTasks, useTaskStore } from '../features/tasks';

// The zustand stores are module-level singletons seeded from fixtures, so a test
// that creates a task pollutes every later test in the same file. Vitest gives
// each test file a fresh module registry, so cross-file leakage is not a
// concern — within-file leakage is.
beforeEach(() => {
  useTaskStore.setState({ tasks: getInitialTasks() });
  useHabitStore.setState({
    habits: getInitialHabits(),
    completions: getInitialHabitCompletions(),
  });
  useGoalStore.setState({ goals: getInitialGoals() });
  useBookStore.setState({ books: getInitialBooks() });
  useListStore.setState({ lists: getInitialLists() });
});

// React Testing Library does not clean up automatically when vitest globals are
// off. Without this, each render appends another copy of the page to the body
// and role queries start matching several elements.
afterEach(() => {
  cleanup();
});
