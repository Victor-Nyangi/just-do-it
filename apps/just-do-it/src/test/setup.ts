import { afterEach, beforeEach } from 'vitest';

// Vitest allows one setup file per project, and this one is shared by both
// environments — the DOM suites opt into jsdom per file with a
// `// @vitest-environment jsdom` docblock, everything else stays on node. So
// the DOM-only work below is gated on there actually being a document.
//
// The gate is a measured win, not a stylistic one. Importing Testing Library
// and the five feature barrels unconditionally dragged jest-dom, React and
// eager fixture parsing into the eleven pure-logic suites, which took them
// from ~2.8s to ~4.5s to run 388ms of assertions.
if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
  const { cleanup } = await import('@testing-library/react');

  const [books, goals, habits, lists, tasks] = await Promise.all([
    import('../features/books'),
    import('../features/goals'),
    import('../features/habits'),
    import('../features/lists'),
    import('../features/tasks'),
  ]);

  // The zustand stores are module-level singletons seeded from fixtures, so a
  // test that creates a task pollutes every later test in the same file. Vitest
  // gives each test file a fresh module registry, so cross-file leakage is not
  // a concern — within-file leakage is.
  beforeEach(() => {
    tasks.useTaskStore.setState({ tasks: tasks.getInitialTasks() });
    habits.useHabitStore.setState({
      habits: habits.getInitialHabits(),
      completions: habits.getInitialHabitCompletions(),
    });
    goals.useGoalStore.setState({ goals: goals.getInitialGoals() });
    books.useBookStore.setState({ books: books.getInitialBooks() });
    lists.useListStore.setState({ lists: lists.getInitialLists() });
  });

  // React Testing Library does not clean up automatically when vitest globals
  // are off. Without this, each render appends another copy of the page to the
  // body and role queries start matching several elements.
  afterEach(() => {
    cleanup();
  });
}
