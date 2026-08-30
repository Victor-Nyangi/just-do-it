// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTaskStore } from '../features/tasks';
import { TasksPage } from './tasks-page';

// Sunday 16 August 2026, midday, matching the other route suites. The tasks
// route itself does not read the clock — filtering and sorting are date-free —
// but the embedded QuickAddField parses relative dates against it.
const pinnedNow = new Date(2026, 7, 16, 12, 0, 0);

// The six fixture tasks, and the two attributes the filters work on:
//
//   Read 20 pages                todo         medium  Reading
//   Go for a run                 in_progress  high    Workout
//   Finish portfolio landing…    todo         urgent  Personal
//   Buy groceries                completed    medium  Errand
//   Paint miniatures             todo         low     Hobby
//   Replace bike light battery   todo         high    Other
//
// The list is unfiltered by status, so all six show by default and one is
// already complete. Two are high priority; every category is unique.
const ALL_TASK_TITLES = [
  'Read 20 pages',
  'Go for a run',
  'Finish portfolio landing page',
  'Buy groceries',
  'Paint miniatures',
  'Replace bike light battery',
];

function renderTasks() {
  return render(
    <MemoryRouter>
      <TasksPage />
    </MemoryRouter>,
  );
}

function setUpUser() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

// `handleEdit` and the "New task" button both call `scrollIntoView`, and jsdom
// does not implement it at all — not as a no-op, but as an absent property, so
// `vi.spyOn` cannot wrap it either ("The property is not defined on the
// object"). It has to be assigned outright, and every edit throws without it.
Element.prototype.scrollIntoView = vi.fn();

// The filter panel used to label its controls "Priority" and "Category", which
// collided with the composer's own fields and forced every query in this file
// to be scoped by containment. The filters are now "Filter by priority" and
// "Filter by category", so plain label queries are unambiguous — which is the
// point of that change: a screen-reader user listing the form controls had the
// same problem the tests did.
function getFilterSelect(label: 'Filter by priority' | 'Filter by category') {
  return screen.getByLabelText(label);
}

function getEditButton(title: string) {
  return screen.getByRole('button', { name: `Edit ${title}` });
}

function queryEditButton(title: string) {
  return screen.queryByRole('button', { name: `Edit ${title}` });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(pinnedNow);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TasksPage — the list', () => {
  it('shows every task, completed ones included', () => {
    renderTasks();

    for (const title of ALL_TASK_TITLES) {
      expect(getEditButton(title)).toBeInTheDocument();
    }
  });

  it('counts what is in view and how many are done', () => {
    renderTasks();

    expect(screen.getByText('6 tasks in view.')).toBeInTheDocument();
    expect(screen.getByText('1 completed')).toBeInTheDocument();
  });
});

describe('TasksPage — filtering', () => {
  it('narrows the list to a priority', async () => {
    const user = setUpUser();
    renderTasks();

    await user.selectOptions(getFilterSelect('Filter by priority'), 'high');

    expect(screen.getByText('2 tasks in view.')).toBeInTheDocument();
    expect(getEditButton('Go for a run')).toBeInTheDocument();
    expect(getEditButton('Replace bike light battery')).toBeInTheDocument();
    expect(queryEditButton('Read 20 pages')).not.toBeInTheDocument();
  });

  // Singular copy, which a naive `${n} tasks` template would get wrong.
  it('uses singular copy for a single match', async () => {
    const user = setUpUser();
    renderTasks();

    await user.selectOptions(getFilterSelect('Filter by category'), 'Reading');

    expect(screen.getByText('1 task in view.')).toBeInTheDocument();
  });

  it('combines the two filters rather than replacing one with the other', async () => {
    const user = setUpUser();
    renderTasks();

    // High priority holds Workout and Other; no task is both high and Reading.
    await user.selectOptions(getFilterSelect('Filter by priority'), 'high');
    await user.selectOptions(getFilterSelect('Filter by category'), 'Reading');

    expect(screen.getByText('No matching tasks yet.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nothing to show right now' })).toBeInTheDocument();
  });

  it('restores the full list when the filters are cleared', async () => {
    const user = setUpUser();
    renderTasks();

    await user.selectOptions(getFilterSelect('Filter by priority'), 'high');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(screen.getByText('6 tasks in view.')).toBeInTheDocument();
    expect(getFilterSelect('Filter by priority')).toHaveValue('all');
  });
});

describe('TasksPage — acting on a task', () => {
  it('completes a task, which relabels the button and moves the done count', async () => {
    const user = setUpUser();
    renderTasks();

    await user.click(screen.getByRole('button', { name: 'Complete Read 20 pages' }));

    expect(screen.getByRole('button', { name: 'Reopen Read 20 pages' })).toBeInTheDocument();
    expect(screen.getByText('2 completed')).toBeInTheDocument();
  });

  it('reopens a task that was already complete', async () => {
    const user = setUpUser();
    renderTasks();

    await user.click(screen.getByRole('button', { name: 'Reopen Buy groceries' }));

    expect(screen.getByRole('button', { name: 'Complete Buy groceries' })).toBeInTheDocument();
    expect(screen.getByText('0 completed')).toBeInTheDocument();
  });

  it('deletes a task off the list and out of the store', async () => {
    const user = setUpUser();
    renderTasks();

    await user.click(screen.getByRole('button', { name: 'Delete Paint miniatures' }));

    expect(queryEditButton('Paint miniatures')).not.toBeInTheDocument();
    expect(screen.getByText('5 tasks in view.')).toBeInTheDocument();
    expect(useTaskStore.getState().tasks.some((task) => task.title === 'Paint miniatures')).toBe(
      false,
    );
  });
});

describe('TasksPage — the composer', () => {
  it('creates a task from the full form', async () => {
    const user = setUpUser();
    renderTasks();

    await user.type(screen.getByLabelText('Title'), 'Sharpen the chisels');
    await user.selectOptions(screen.getByLabelText('Priority'), 'urgent');
    await user.selectOptions(screen.getByLabelText('Category'), 'Hobby');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    expect(getEditButton('Sharpen the chisels')).toBeInTheDocument();
    expect(screen.getByText('7 tasks in view.')).toBeInTheDocument();
    expect(
      useTaskStore.getState().tasks.find((task) => task.title === 'Sharpen the chisels'),
    ).toMatchObject({ priority: 'urgent', category: 'Hobby' });
  });

  // `taskSchema` requires a non-empty title, so a whitespace-only one throws if
  // it reaches the store rather than being written — which makes "no task was
  // added" true whether the form declined it or crashed. The window `error`
  // listener is what separates those; see quick-add-field.test.tsx for the same
  // pattern and why console.error does not catch it.
  it('refuses a title that is only whitespace, without throwing', async () => {
    const user = setUpUser();
    const countBefore = useTaskStore.getState().tasks.length;
    const uncaught: string[] = [];
    const recordError = (event: ErrorEvent) => {
      uncaught.push(String(event.error ?? event.message));
    };
    window.addEventListener('error', recordError);

    try {
      renderTasks();

      await user.type(screen.getByLabelText('Title'), '   ');
      await user.click(screen.getByRole('button', { name: 'Create task' }));

      expect(useTaskStore.getState().tasks).toHaveLength(countBefore);
      expect(uncaught).toEqual([]);
    } finally {
      window.removeEventListener('error', recordError);
    }
  });

  it('switches into edit mode and prefills from the chosen task', async () => {
    const user = setUpUser();
    renderTasks();

    await user.click(getEditButton('Go for a run'));

    expect(screen.getByRole('heading', { name: 'Update Go for a run' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Go for a run');
    expect(screen.getByLabelText('Priority')).toHaveValue('high');
    expect(screen.getByLabelText('Category')).toHaveValue('Workout');
  });

  it('saves an edit back to the task rather than creating a second one', async () => {
    const user = setUpUser();
    const countBefore = useTaskStore.getState().tasks.length;
    renderTasks();

    await user.click(getEditButton('Go for a run'));
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Go for a longer run');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(getEditButton('Go for a longer run')).toBeInTheDocument();
    expect(queryEditButton('Go for a run')).not.toBeInTheDocument();
    expect(useTaskStore.getState().tasks).toHaveLength(countBefore);
  });

  it('returns to create mode when an edit is cancelled', async () => {
    const user = setUpUser();
    renderTasks();

    await user.click(getEditButton('Go for a run'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('heading', { name: 'Create a task' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('');
  });

  // Deleting the task being edited has to drop the composer back to create
  // mode, or the form would be bound to a task that no longer exists — and it
  // must actually reset, not merely relabel, which is why the title is asserted
  // as well as the heading.
  //
  // Note where that behaviour comes from. `handleDelete` calls `resetComposer`
  // when the deleted task is the one being edited, but `editingTask` is derived
  // from the live task list, so it goes null the moment the task leaves the
  // store — which flips the heading, swaps `formKey` from `edit-…` to
  // `create-…` and remounts the form with defaults on its own. Deleting the
  // explicit guard changes nothing observable (confirmed by mutation). This
  // test pins the outcome rather than that line.
  it('leaves edit mode when the task being edited is deleted', async () => {
    const user = setUpUser();
    renderTasks();

    await user.click(getEditButton('Go for a run'));
    await user.click(screen.getByRole('button', { name: 'Delete Go for a run' }));

    expect(screen.getByRole('heading', { name: 'Create a task' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('');
  });
});

describe('TasksPage — quick add', () => {
  it('adds through the quick-add field as well as the composer', async () => {
    const user = setUpUser();
    renderTasks();

    await user.type(screen.getByRole('textbox', { name: 'Quick add task' }), 'Oil the hinges');
    await user.click(screen.getByRole('button', { name: 'Add task' }));

    expect(getEditButton('Oil the hinges')).toBeInTheDocument();
    expect(screen.getByText('7 tasks in view.')).toBeInTheDocument();
  });
});
