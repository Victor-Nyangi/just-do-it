// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTaskStore } from '../tasks';
import { CommandPalette } from './command-palette';

// Thursday 27 August 2026, midday — the date quick-add-parser.test.ts pins, so
// the two agree on what "Friday" means. The palette parses relative dates
// against the real clock, so it has to be pinned.
const pinnedNow = new Date(2026, 7, 27, 12, 0, 0);

function renderPalette(onToggleTheme = vi.fn()) {
  return {
    onToggleTheme,
    ...render(
      <MemoryRouter initialEntries={['/today']}>
        <Routes>
          <Route element={<CommandPalette onToggleTheme={onToggleTheme} />} path="/today" />
          <Route element={<h1>Calendar stub</h1>} path="/calendar" />
        </Routes>
      </MemoryRouter>,
    ),
  };
}

function setUpUser() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

async function openPalette(user: ReturnType<typeof setUpUser>) {
  await user.keyboard('{Meta>}k{/Meta}');
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(pinnedNow);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CommandPalette — opening and closing', () => {
  it('is closed until it is asked for', () => {
    renderPalette();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens on the keyboard shortcut', async () => {
    const user = setUpUser();
    renderPalette();

    await openPalette(user);

    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = setUpUser();
    renderPalette();

    await openPalette(user);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('CommandPalette — running commands', () => {
  it('filters the list as the query is typed', async () => {
    const user = setUpUser();
    renderPalette();

    await openPalette(user);
    await user.type(screen.getByRole('combobox', { name: 'Command palette' }), 'cal');

    expect(screen.getByRole('option', { name: /Calendar/u })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Books/u })).not.toBeInTheDocument();
  });

  it('says so when nothing matches', async () => {
    const user = setUpUser();
    renderPalette();

    await openPalette(user);
    await user.type(screen.getByRole('combobox', { name: 'Command palette' }), 'zzzz');

    expect(screen.getByText('No matching commands')).toBeInTheDocument();
  });

  it('navigates and closes when a route is chosen', async () => {
    const user = setUpUser();
    renderPalette();

    await openPalette(user);
    await user.click(screen.getByRole('option', { name: /Calendar/u }));

    expect(screen.getByRole('heading', { name: 'Calendar stub' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('toggles the theme and closes', async () => {
    const user = setUpUser();
    const { onToggleTheme } = renderPalette();

    await openPalette(user);
    await user.click(screen.getByRole('option', { name: 'Toggle dark mode' }));

    expect(onToggleTheme).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('CommandPalette — creating a task', () => {
  it('switches into quick-add mode without closing', async () => {
    const user = setUpUser();
    renderPalette();

    await openPalette(user);
    await user.click(screen.getByRole('option', { name: 'New task…' }));

    expect(screen.getByRole('dialog', { name: 'New task' })).toBeInTheDocument();
  });

  it('creates the task with the parsed fields', async () => {
    const user = setUpUser();
    const existingIds = new Set(useTaskStore.getState().tasks.map((task) => task.id));
    renderPalette();

    await openPalette(user);
    await user.click(screen.getByRole('option', { name: 'New task…' }));
    await user.type(
      screen.getByRole('combobox', { name: 'New task' }),
      'Read 20 pages Friday #Reading !high{Enter}',
    );

    const created = useTaskStore.getState().tasks.find((task) => !existingIds.has(task.id));

    expect(created).toMatchObject({
      title: 'Read 20 pages',
      dueDate: '2026-08-28',
      category: 'Reading',
      priority: 'high',
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('applies the quick-add defaults to a bare title', async () => {
    const user = setUpUser();
    const existingIds = new Set(useTaskStore.getState().tasks.map((task) => task.id));
    renderPalette();

    await openPalette(user);
    await user.click(screen.getByRole('option', { name: 'New task…' }));
    await user.type(screen.getByRole('combobox', { name: 'New task' }), 'Water the plants{Enter}');

    expect(useTaskStore.getState().tasks.find((task) => !existingIds.has(task.id))).toMatchObject({
      status: 'todo',
      priority: 'medium',
      category: 'Personal',
    });
  });

  it('does not create a task with no title', async () => {
    const user = setUpUser();
    const countBefore = useTaskStore.getState().tasks.length;
    renderPalette();

    await openPalette(user);
    await user.click(screen.getByRole('option', { name: 'New task…' }));
    await user.type(screen.getByRole('combobox', { name: 'New task' }), '#Reading{Enter}');

    expect(useTaskStore.getState().tasks).toHaveLength(countBefore);
  });

  // Escape from quick-add steps back rather than closing, so a mis-selected
  // command costs one key rather than reopening the palette.
  it('steps back to the command list on Escape', async () => {
    const user = setUpUser();
    renderPalette();

    await openPalette(user);
    await user.click(screen.getByRole('option', { name: 'New task…' }));
    await user.keyboard('{Escape}');

    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'New task…' })).toBeInTheDocument();
  });
});

// Each mode returns its `Command` under a distinct `key`, so switching mode
// unmounts one dialog and mounts the other. The primitive captures its
// focus-restore target once, on mount, so the mode switch moves that target —
// and nothing else covers what happens to it. React runs a commit's passive
// cleanups before its passive effects, so the outgoing dialog hands focus back
// to the opener before the incoming one captures it; these pin that, because
// the alternative is focus stranded on `document.body` after every quick-add.
describe('CommandPalette — focus across a mode switch', () => {
  function renderWithOpener() {
    const view = render(
      <MemoryRouter initialEntries={['/today']}>
        <button type="button">Open something</button>
        <CommandPalette onToggleTheme={vi.fn()} />
      </MemoryRouter>,
    );
    const opener = screen.getByRole('button', { name: 'Open something' });
    opener.focus();

    return { ...view, opener };
  }

  it('returns focus to the opener after stepping back out of quick-add mode', async () => {
    const user = setUpUser();
    const { opener } = renderWithOpener();

    await openPalette(user);
    await user.click(screen.getByRole('option', { name: 'New task…' }));
    expect(screen.getByRole('dialog', { name: 'New task' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('returns focus to the opener when a task is created from quick-add mode', async () => {
    const user = setUpUser();
    const { opener } = renderWithOpener();

    await openPalette(user);
    await user.click(screen.getByRole('option', { name: 'New task…' }));
    await user.type(screen.getByRole('combobox', { name: 'New task' }), 'Buy milk{Enter}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
