// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTaskStore } from '../task-store';
import { QuickAddField } from './quick-add-field';

// Thursday 27 August 2026, the same date `quick-add-parser.test.ts` pins, so
// the two suites agree on what "Friday" resolves to. Midday rather than
// midnight, so a clock creeping forward under `shouldAdvanceTime` cannot roll
// the date over.
//
// The clock matters here even though nothing on screen prints it:
// `QuickAddField` calls `parseQuickAdd(draft)` without a `now`, so the parser
// falls back to `new Date()` and every relative date in the preview is
// resolved against the real clock.
const pinnedNow = new Date(2026, 7, 27, 12, 0, 0);

// What the parser does with the text is `quick-add-parser.test.ts`'s job, and
// it is thorough. These tests cover only what the component adds on top: the
// live preview, the defaults it supplies for fields the parser deliberately
// omits, the submit gating, and the store write. Where a test types a rich
// string it is to reach a component behaviour, not to re-check the grammar.

function setUpUser() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

function getInput() {
  return screen.getByRole('textbox', { name: 'Quick add task' });
}

// Identify the new task by an id the store did not have before, never by
// title: `tasks.json` already ships a "Read 20 pages" due 2026-08-16, so a
// title lookup silently returns the fixture row and the assertions then
// describe fixture data instead of anything the component did.
function snapshotTaskIds() {
  return new Set(useTaskStore.getState().tasks.map((task) => task.id));
}

function getTaskCreatedSince(existingIds: Set<string>) {
  return useTaskStore.getState().tasks.find((task) => !existingIds.has(task.id));
}

function getSubmitButton() {
  return screen.getByRole('button', { name: 'Add task' });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(pinnedNow);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('QuickAddField — the live preview', () => {
  it('explains the syntax while the field is empty', () => {
    render(<QuickAddField />);

    expect(screen.getByText(/and they will be read out of the text/u)).toBeInTheDocument();
  });

  it('asks for a title when the text parses to nothing but metadata', async () => {
    const user = setUpUser();
    render(<QuickAddField />);

    await user.type(getInput(), 'Friday #Reading !high');

    expect(screen.getByText(/Add a title/u)).toBeInTheDocument();
  });

  it('previews the title and the parsed fields as they are typed', async () => {
    const user = setUpUser();
    render(<QuickAddField />);

    await user.type(getInput(), 'Read 20 pages Friday #Reading !high');

    expect(screen.getByText('Read 20 pages')).toBeInTheDocument();
    expect(screen.getByText('Fri 28 Aug')).toBeInTheDocument();
    expect(screen.getByText('Reading')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  // The parser omits absent fields rather than defaulting them, so that
  // `'dueDate' in result` stays meaningful. Supplying the defaults is this
  // component's job, and this is the seam where that contract is visible.
  it('fills in its own defaults for the fields the parser leaves out', async () => {
    const user = setUpUser();
    render(<QuickAddField />);

    await user.type(getInput(), 'Water the plants');

    expect(screen.getByText('No date')).toBeInTheDocument();
    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
  });
});

describe('QuickAddField — submit gating', () => {
  it('disables the button while there is no title to add', () => {
    render(<QuickAddField />);

    expect(getSubmitButton()).toBeDisabled();
  });

  it('keeps the button disabled when the text is only metadata', async () => {
    const user = setUpUser();
    render(<QuickAddField />);

    await user.type(getInput(), '#Reading !high');

    expect(getSubmitButton()).toBeDisabled();
  });

  it('enables the button once a title is present', async () => {
    const user = setUpUser();
    render(<QuickAddField />);

    await user.type(getInput(), 'Water the plants');

    expect(getSubmitButton()).toBeEnabled();
  });
});

describe('QuickAddField — creating the task', () => {
  it('writes the parsed fields to the store', async () => {
    const user = setUpUser();
    const existingIds = snapshotTaskIds();
    render(<QuickAddField />);

    await user.type(getInput(), 'Read 20 pages Friday #Reading !high');
    await user.click(getSubmitButton());

    expect(getTaskCreatedSince(existingIds)).toMatchObject({
      title: 'Read 20 pages',
      dueDate: '2026-08-28',
      category: 'Reading',
      priority: 'high',
    });
  });

  it('applies the todo/medium/Personal defaults to a bare title', async () => {
    const user = setUpUser();
    const existingIds = snapshotTaskIds();
    render(<QuickAddField />);

    await user.type(getInput(), 'Water the plants');
    await user.click(getSubmitButton());

    const created = getTaskCreatedSince(existingIds);

    expect(created).toMatchObject({
      title: 'Water the plants',
      status: 'todo',
      priority: 'medium',
      category: 'Personal',
    });
    expect(created?.dueDate).toBeUndefined();
  });

  it('adds one task rather than replacing the existing ones', async () => {
    const user = setUpUser();
    const countBefore = useTaskStore.getState().tasks.length;
    render(<QuickAddField />);

    await user.type(getInput(), 'Water the plants');
    await user.click(getSubmitButton());

    expect(useTaskStore.getState().tasks).toHaveLength(countBefore + 1);
  });

  it('submits on Enter as well as on the button', async () => {
    const user = setUpUser();
    const existingIds = snapshotTaskIds();
    render(<QuickAddField />);

    await user.type(getInput(), 'Water the plants{Enter}');

    expect(getTaskCreatedSince(existingIds)).toMatchObject({ title: 'Water the plants' });
  });

  // A metadata-only draft has an empty title, and `taskSchema` requires a
  // non-empty one — so if this path ever reaches the store it throws instead of
  // writing a bad task. "No task was created" is therefore true both when the
  // draft is declined cleanly and when it blows up inside Zod, and on its own
  // this test would pass either way.
  //
  // The window `error` listener separates them. An exception escaping a React
  // event handler surfaces as an uncaught error on the window, which vitest
  // reports as an unhandled error *without* failing the test that caused it —
  // so it has to be asserted on deliberately. It does not reach console.error.
  it('declines a titleless draft on Enter without throwing', async () => {
    const user = setUpUser();
    const existingIds = snapshotTaskIds();
    const uncaught: string[] = [];
    const recordError = (event: ErrorEvent) => {
      uncaught.push(String(event.error ?? event.message));
    };
    window.addEventListener('error', recordError);

    try {
      render(<QuickAddField />);

      await user.type(getInput(), '#Reading !high{Enter}');

      expect(getTaskCreatedSince(existingIds)).toBeUndefined();
      expect(uncaught).toEqual([]);
    } finally {
      window.removeEventListener('error', recordError);
    }
  });

  it('clears the field and returns to the empty hint after adding', async () => {
    const user = setUpUser();
    render(<QuickAddField />);

    await user.type(getInput(), 'Water the plants');
    await user.click(getSubmitButton());

    expect(getInput()).toHaveValue('');
    expect(screen.getByText(/and they will be read out of the text/u)).toBeInTheDocument();
    expect(getSubmitButton()).toBeDisabled();
  });
});
