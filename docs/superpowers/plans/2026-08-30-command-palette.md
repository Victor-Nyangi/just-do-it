# Command Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a ⌘K command palette that navigates to any top-level route, toggles the theme, and creates a task with the existing quick-add syntax, plus `g`-then-key navigation chords.

**Architecture:** A presentational `Command` primitive in `packages/ui` owns the dialog, the ARIA wiring and the arrow-key behaviour, and renders exactly the options it is handed — it does no filtering and knows nothing about routes or stores. The app's `features/command-palette` module owns the state: which commands exist (`buildCommands`, a pure function), which are visible (substring filter in the container), and whether the palette is in `root` or `new-task` mode. `AppLayout` mounts the container once and passes its existing theme setter down.

**Tech Stack:** React 19, TypeScript, react-router-dom, zustand, Tailwind v4 via CSS custom properties, vitest + Testing Library (jsdom per file).

**Spec:** `docs/superpowers/specs/2026-08-30-command-palette-design.md`

## Global Constraints

- **No new runtime dependencies.** The primitive is hand-written, like `Button`, `Card`, `Badge` and `Input`. Do not add `cmdk`, `radix`, or a focus-trap library.
- **`packages/ui` imports nothing from the app.** No `react-router-dom`, no stores, no domain types. It has no test runner (`build`, `lint`, `typecheck` are all `tsc --noEmit`), so its tests live in the app.
- **Colours come from CSS custom properties only** — `bg-[var(--surface)]`, `text-[var(--muted-foreground)]`. Never a hex or a Tailwind palette class. Add a token to both `:root` and `:root[data-theme='dark']` in `packages/ui/src/styles.css` if you need a new one.
- **Barrels only.** Routes and layouts import from `'../features/<domain>'`, never a deeper path. Anything a consumer needs must be added to `index.ts`.
- **Variable names are spelled out.** `nextIndex`, `pendingChordKey` — not `i`, `k`.
- **Icons from `lucide-react`, dates from `date-fns`, ids from `crypto.randomUUID()`.**
- **Run `pnpm format` before every commit.** There is no pre-commit hook and CI runs `format:check`.
- **Commits are Conventional Commits scoped by domain**, e.g. `feat(palette):`.
- Test files opt into jsdom with a `// @vitest-environment jsdom` docblock on line 1. Query by role and accessible name. Any test that pins the clock must bridge fake timers into user-event with `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`.

---

### Task 1: Extract `toQuickAddTaskInput` from `QuickAddField`

`QuickAddField` currently owns the mapping from a parse result to a `TaskInput`, including the `todo`/`medium`/`Personal` defaults the parser deliberately omits. The palette needs the identical mapping. Extract it first so there is only ever one copy.

**Files:**

- Create: `apps/just-do-it/src/features/tasks/quick-add-input.ts`
- Create: `apps/just-do-it/src/features/tasks/quick-add-input.test.ts`
- Modify: `apps/just-do-it/src/features/tasks/components/quick-add-field.tsx` (the `submit` function, lines 20-34)
- Modify: `apps/just-do-it/src/features/tasks/index.ts` (add the export)

**Interfaces:**

- Consumes: `QuickAddParseResult` and `TaskInput`, both already exported from `features/tasks`.
- Produces: `toQuickAddTaskInput(parsed: QuickAddParseResult): TaskInput` — used by Task 5.

- [ ] **Step 1: Write the failing test**

Create `apps/just-do-it/src/features/tasks/quick-add-input.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { toQuickAddTaskInput } from './quick-add-input';

describe('toQuickAddTaskInput', () => {
  it('carries every parsed field through', () => {
    expect(
      toQuickAddTaskInput({
        title: 'Read 20 pages',
        dueDate: '2026-08-28',
        category: 'Reading',
        priority: 'high',
      }),
    ).toMatchObject({
      title: 'Read 20 pages',
      dueDate: '2026-08-28',
      category: 'Reading',
      priority: 'high',
      status: 'todo',
    });
  });

  // The parser omits absent fields rather than defaulting them, so that
  // `'dueDate' in result` stays meaningful. Supplying the defaults is this
  // function's whole job.
  it('applies the todo/medium/Personal defaults to a bare title', () => {
    const input = toQuickAddTaskInput({ title: 'Water the plants' });

    expect(input).toMatchObject({
      title: 'Water the plants',
      status: 'todo',
      priority: 'medium',
      category: 'Personal',
    });
    expect(input.dueDate).toBeUndefined();
  });

  it('defaults recurrence to none with an interval of one', () => {
    expect(toQuickAddTaskInput({ title: 'Water the plants' })).toMatchObject({
      recurrence: 'none',
      recurrenceInterval: 1,
    });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd apps/just-do-it && pnpm exec vitest run src/features/tasks/quick-add-input.test.ts`
Expected: FAIL — `Failed to resolve import "./quick-add-input"`.

- [ ] **Step 3: Write the implementation**

Create `apps/just-do-it/src/features/tasks/quick-add-input.ts`:

```ts
import { defaultTaskEditorValues, toTaskInput } from './task-data';
import type { QuickAddParseResult } from './quick-add-parser';
import type { TaskInput } from './types';

// `parseQuickAdd` applies no defaults — an absent field means "not specified",
// not "use the default". Choosing the defaults is a UI decision, and this is
// where it is made, so that every quick-add surface makes it identically.
export function toQuickAddTaskInput(parsed: QuickAddParseResult): TaskInput {
  return toTaskInput({
    ...defaultTaskEditorValues,
    title: parsed.title,
    dueDate: parsed.dueDate ?? '',
    category: parsed.category ?? defaultTaskEditorValues.category,
    priority: parsed.priority ?? defaultTaskEditorValues.priority,
  });
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `cd apps/just-do-it && pnpm exec vitest run src/features/tasks/quick-add-input.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Point `QuickAddField` at it**

In `apps/just-do-it/src/features/tasks/components/quick-add-field.tsx`, replace the `submit` function body:

```tsx
function submit() {
  if (!hasTitle) return;

  createTask(toQuickAddTaskInput(parsed));
  setDraft('');
}
```

Update the imports at the top of that file — `defaultTaskEditorValues` is still needed for the preview chips, but `toTaskInput` is not:

```tsx
import { defaultTaskEditorValues } from '../task-data';
import { toQuickAddTaskInput } from '../quick-add-input';
import { useCreateTask } from '../hooks';
import { parseQuickAdd } from '../quick-add-parser';
```

- [ ] **Step 6: Export it from the barrel**

In `apps/just-do-it/src/features/tasks/index.ts`, add alongside the other value exports:

```ts
export { toQuickAddTaskInput } from './quick-add-input';
```

- [ ] **Step 7: Verify nothing regressed**

Run: `cd apps/just-do-it && pnpm exec vitest run`
Expected: PASS — 404 tests (401 before, plus the 3 new ones). The existing
`quick-add-field.test.tsx` and `tasks-page.test.tsx` suites must still pass untouched; they are the
proof the extraction changed no behaviour.

- [ ] **Step 8: Commit**

```bash
cd "/home/nyangi/Bread/Projects/In Progress/indie-mono-repo"
pnpm format
git add apps/just-do-it/src/features/tasks
git commit -m "refactor(tasks): extract toQuickAddTaskInput from QuickAddField"
```

---

### Task 2: The `Command` primitive in `packages/ui`

A controlled, presentational dialog. It renders the options it is given, in the order given, grouped by their `group` field. It does not filter — the container does that, because in `new-task` mode there is nothing to filter.

**Files:**

- Create: `packages/ui/src/components/command.tsx`
- Modify: `packages/ui/src/index.ts`
- Create: `apps/just-do-it/src/test/ui-command.test.tsx`

**Interfaces:**

- Consumes: `cn` from `packages/ui/src/lib/cn`.
- Produces:

```ts
export type CommandOption = {
  id: string;
  group: string;
  label: string;
  hint?: string;
};

export type CommandProps = {
  ariaLabel: string;
  emptyLabel: string;
  footer?: ReactNode;
  onDismiss: () => void;
  onQueryChange: (query: string) => void;
  onSelect: (optionId: string) => void;
  options: readonly CommandOption[];
  placeholder: string;
  query: string;
};
```

Task 5 renders `<Command />` with these props.

- [ ] **Step 1: Write the failing test**

Create `apps/just-do-it/src/test/ui-command.test.tsx`. It lives in the app, not the package, because `packages/ui` has no test runner — its `test` script is `tsc --noEmit`.

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Command, type CommandOption } from '@just-do-it/ui';

// `packages/ui` has no vitest of its own, so its components are covered from
// the app. This file is the primitive's only direct test; the palette that
// consumes it is tested separately in features/command-palette.
const options: CommandOption[] = [
  { id: 'today', group: 'Navigate', label: 'Today', hint: 'g t' },
  { id: 'tasks', group: 'Navigate', label: 'Tasks', hint: 'g k' },
  { id: 'theme', group: 'Actions', label: 'Toggle dark mode' },
];

function Harness({
  onSelect = () => {},
  onDismiss = () => {},
  visible = options,
}: {
  onSelect?: (optionId: string) => void;
  onDismiss?: () => void;
  visible?: readonly CommandOption[];
}) {
  const [query, setQuery] = useState('');

  return (
    <Command
      ariaLabel="Command palette"
      emptyLabel="No matching commands"
      onDismiss={onDismiss}
      onQueryChange={setQuery}
      onSelect={onSelect}
      options={visible}
      placeholder="Type a command"
      query={query}
    />
  );
}

describe('Command — structure', () => {
  it('is a labelled modal dialog', () => {
    render(<Harness />);

    const dialog = screen.getByRole('dialog', { name: 'Command palette' });

    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('gives the input a combobox role wired to the listbox', () => {
    render(<Harness />);

    const input = screen.getByRole('combobox', { name: 'Command palette' });

    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', screen.getByRole('listbox').id);
  });

  it('renders every option as an option, grouped', () => {
    render(<Harness />);

    expect(screen.getByRole('option', { name: /Today/u })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Navigate' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Actions' })).toBeInTheDocument();
  });

  it('focuses the input on mount', () => {
    render(<Harness />);

    expect(screen.getByRole('combobox', { name: 'Command palette' })).toHaveFocus();
  });

  // Without this, closing the palette leaves focus on document.body and the
  // next Tab restarts from the top of the page.
  it('returns focus where it came from when it unmounts', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();

    const { unmount } = render(<Harness />);
    expect(trigger).not.toHaveFocus();

    unmount();
    expect(trigger).toHaveFocus();

    trigger.remove();
  });

  it('shows the empty label when there is nothing to show', () => {
    render(<Harness visible={[]} />);

    expect(screen.getByText('No matching commands')).toBeInTheDocument();
  });
});

describe('Command — keyboard', () => {
  it('marks the first option active on mount', () => {
    render(<Harness />);

    expect(screen.getByRole('option', { name: /Today/u })).toHaveAttribute('aria-selected', 'true');
  });

  // Focus must stay in the input so typing keeps working; the active option is
  // tracked with aria-activedescendant instead.
  it('keeps focus in the input while arrowing', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.keyboard('{ArrowDown}');

    const input = screen.getByRole('combobox', { name: 'Command palette' });

    expect(input).toHaveFocus();
    expect(screen.getByRole('option', { name: /Tasks/u })).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: /Tasks/u }).id,
    );
  });

  it('wraps from the last option back to the first', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.keyboard('{ArrowUp}');

    expect(screen.getByRole('option', { name: 'Toggle dark mode' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('selects the active option on Enter', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);

    await user.keyboard('{ArrowDown}{Enter}');

    expect(onSelect).toHaveBeenCalledWith('tasks');
  });

  it('dismisses on Escape', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} />);

    await user.keyboard('{Escape}');

    expect(onDismiss).toHaveBeenCalled();
  });

  it('does nothing on Enter when there is nothing to select', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} visible={[]} />);

    await user.keyboard('{Enter}');

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('selects an option that is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);

    await user.click(screen.getByRole('option', { name: 'Toggle dark mode' }));

    expect(onSelect).toHaveBeenCalledWith('theme');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd apps/just-do-it && pnpm exec vitest run src/test/ui-command.test.tsx`
Expected: FAIL — `Command` is not exported from `@just-do-it/ui`.

- [ ] **Step 3: Write the primitive**

Create `packages/ui/src/components/command.tsx`:

```tsx
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

import { cn } from '../lib/cn';

export type CommandOption = {
  id: string;
  group: string;
  label: string;
  hint?: string;
};

export type CommandProps = {
  ariaLabel: string;
  emptyLabel: string;
  footer?: ReactNode;
  onDismiss: () => void;
  onQueryChange: (query: string) => void;
  onSelect: (optionId: string) => void;
  options: readonly CommandOption[];
  placeholder: string;
  query: string;
};

// Presentational only: it renders the options it is handed, in the order it is
// handed them, and reports what the user did. Filtering, routing and any idea
// of what a command means all live in the consumer.
export function Command({
  ariaLabel,
  emptyLabel,
  footer,
  onDismiss,
  onQueryChange,
  onSelect,
  options,
  placeholder,
  query,
}: CommandProps) {
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // The option list changes as the user types, so an index held from a previous
  // list can point past the end of the new one.
  useEffect(() => {
    setActiveIndex(0);
  }, [options]);

  // Focus moves in on open and must go back where it came from on unmount, or
  // closing the palette strands focus on `document.body` and the next Tab
  // starts from the top of the page.
  useEffect(() => {
    const previouslyFocused = document.activeElement;

    inputRef.current?.focus();

    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  const groups = useMemo(() => {
    const grouped = new Map<string, CommandOption[]>();

    for (const option of options) {
      const existing = grouped.get(option.group);

      if (existing) {
        existing.push(option);
      } else {
        grouped.set(option.group, [option]);
      }
    }

    return [...grouped.entries()];
  }, [options]);

  const activeOption = options[activeIndex];

  function moveActiveIndex(offset: number) {
    if (options.length === 0) return;

    setActiveIndex((current) => {
      const nextIndex = (current + offset + options.length) % options.length;
      return nextIndex;
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActiveIndex(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActiveIndex(-1);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (activeOption) onSelect(activeOption.id);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      onDismiss();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24">
      <div
        aria-label={ariaLabel}
        aria-modal="true"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        role="dialog"
      >
        <input
          aria-activedescendant={activeOption ? `${baseId}-${activeOption.id}` : undefined}
          aria-controls={listboxId}
          aria-expanded="true"
          aria-label={ariaLabel}
          autoComplete="off"
          className="w-full border-b border-[var(--border)] bg-transparent px-4 py-3 text-sm outline-none placeholder:text-[var(--muted-foreground)]"
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          ref={inputRef}
          role="combobox"
          value={query}
        />

        {/* Deliberately divs rather than ul/li: a `role="listbox"` may only
            contain options and groups, and `<li>` carries an implicit
            listitem role that would make the structure invalid. */}
        <div className="max-h-80 overflow-y-auto p-2" id={listboxId} role="listbox">
          {options.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[var(--muted-foreground)]">
              {emptyLabel}
            </p>
          ) : (
            groups.map(([group, groupOptions]) => (
              <div aria-label={group} key={group} role="group">
                <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  {group}
                </p>
                {groupOptions.map((option) => {
                  const isActive = option.id === activeOption?.id;

                  return (
                    <div
                      aria-selected={isActive}
                      className={cn(
                        'flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm',
                        isActive
                          ? 'bg-[var(--primary-subtle)] text-[var(--primary)]'
                          : 'text-[var(--foreground)]',
                      )}
                      id={`${baseId}-${option.id}`}
                      key={option.id}
                      onClick={() => onSelect(option.id)}
                      role="option"
                    >
                      <span>{option.label}</span>
                      {option.hint ? (
                        <kbd className="rounded border border-[var(--border)] px-1.5 py-0.5 text-xs text-[var(--muted-foreground)]">
                          {option.hint}
                        </kbd>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {footer ? (
          <div className="border-t border-[var(--border)] px-4 py-3 text-sm">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Export it**

In `packages/ui/src/index.ts`, add in alphabetical position (before `Input`):

```ts
export { Command } from './components/command';
export type { CommandOption, CommandProps } from './components/command';
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `cd apps/just-do-it && pnpm exec vitest run src/test/ui-command.test.tsx`
Expected: PASS, 14 tests.

If `aria-selected` assertions fail because the option renders `aria-selected="false"` as absent,
note that `aria-selected={isActive}` on a `div` renders the literal string — it should work. If the
listbox-id assertion fails, check that `useId` output is being interpolated the same way in both the
`aria-controls` and the `id` attribute.

- [ ] **Step 6: Commit**

```bash
cd "/home/nyangi/Bread/Projects/In Progress/indie-mono-repo"
pnpm format
git add packages/ui apps/just-do-it/src/test/ui-command.test.tsx
git commit -m "feat(ui): add a presentational Command primitive"
```

---

### Task 3: The command list

**Files:**

- Create: `apps/just-do-it/src/features/command-palette/types.ts`
- Create: `apps/just-do-it/src/features/command-palette/commands.ts`
- Create: `apps/just-do-it/src/features/command-palette/commands.test.ts`
- Create: `apps/just-do-it/src/features/command-palette/index.ts`

**Interfaces:**

- Produces:

```ts
export type CommandMode = 'root' | 'new-task';

export type CommandItem = {
  id: string;
  group: 'Navigate' | 'Actions';
  label: string;
  hint?: string;
  run: () => CommandMode | void;
};

export function buildCommands(handlers: {
  navigate: (to: string) => void;
  toggleTheme: () => void;
}): readonly CommandItem[];
```

Task 5 consumes `buildCommands`. `NAVIGATION_CHORDS` is consumed by Task 4.

- [ ] **Step 1: Write the failing test**

Create `apps/just-do-it/src/features/command-palette/commands.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { NAVIGATION_CHORDS, buildCommands } from './commands';

function build() {
  const navigate = vi.fn();
  const toggleTheme = vi.fn();

  return { commands: buildCommands({ navigate, toggleTheme }), navigate, toggleTheme };
}

describe('buildCommands — navigation', () => {
  it('offers every top-level route', () => {
    const { commands } = build();
    const labels = commands.filter((item) => item.group === 'Navigate').map((item) => item.label);

    expect(labels).toEqual([
      'Today',
      'Tasks',
      'Calendar',
      'Goals',
      'Habits',
      'Books',
      'Lists',
      'Settings',
    ]);
  });

  it('navigates to the matching path when run', () => {
    const { commands, navigate } = build();

    commands.find((item) => item.label === 'Calendar')?.run();

    expect(navigate).toHaveBeenCalledWith('/calendar');
  });

  it('shows the keyboard chord as a hint', () => {
    const { commands } = build();

    expect(commands.find((item) => item.label === 'Tasks')?.hint).toBe('g k');
  });

  // The palette and the chord handler must not drift apart: every route the
  // palette offers should be reachable by its advertised chord.
  it('advertises a chord that NAVIGATION_CHORDS actually maps', () => {
    const { commands } = build();

    for (const item of commands.filter((command) => command.group === 'Navigate')) {
      const chordKey = item.hint?.replace('g ', '');

      expect(chordKey).toBeDefined();
      expect(NAVIGATION_CHORDS[chordKey as string]).toBeDefined();
    }
  });
});

describe('buildCommands — actions', () => {
  it('offers creating a task and toggling the theme', () => {
    const { commands } = build();
    const labels = commands.filter((item) => item.group === 'Actions').map((item) => item.label);

    expect(labels).toEqual(['New task…', 'Toggle dark mode']);
  });

  it('toggles the theme when run', () => {
    const { commands, toggleTheme } = build();

    commands.find((item) => item.label === 'Toggle dark mode')?.run();

    expect(toggleTheme).toHaveBeenCalled();
  });

  // The one command that does not close the palette: it switches it into
  // quick-add mode, which is why `run` returns a mode rather than void.
  it('switches into new-task mode rather than closing', () => {
    const { commands } = build();

    expect(commands.find((item) => item.label === 'New task…')?.run()).toBe('new-task');
  });

  it('returns nothing from the commands that should close the palette', () => {
    const { commands } = build();

    expect(commands.find((item) => item.label === 'Today')?.run()).toBeUndefined();
    expect(commands.find((item) => item.label === 'Toggle dark mode')?.run()).toBeUndefined();
  });

  it('gives every command a distinct id', () => {
    const { commands } = build();

    expect(new Set(commands.map((item) => item.id)).size).toBe(commands.length);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd apps/just-do-it && pnpm exec vitest run src/features/command-palette/commands.test.ts`
Expected: FAIL — cannot resolve `./commands`.

- [ ] **Step 3: Write the types**

Create `apps/just-do-it/src/features/command-palette/types.ts`:

```ts
export type CommandMode = 'root' | 'new-task';

export type CommandGroup = 'Navigate' | 'Actions';

export type CommandItem = {
  id: string;
  group: CommandGroup;
  label: string;
  hint?: string;
  // Returning a mode switches the palette into it; returning nothing closes it.
  run: () => CommandMode | void;
};
```

- [ ] **Step 4: Write the command list**

Create `apps/just-do-it/src/features/command-palette/commands.ts`:

```ts
import type { CommandItem } from './types';

// The single source of truth for `g`-then-key navigation. `buildCommands`
// advertises these as hints and `useGlobalShortcuts` dispatches them, so a
// route can never be offered under a chord that does not work.
//
// `g k` for Tasks because Today claims `t`.
export const NAVIGATION_CHORDS: Readonly<Record<string, string>> = {
  t: '/today',
  k: '/tasks',
  c: '/calendar',
  g: '/goals',
  h: '/habits',
  b: '/books',
  l: '/lists',
  s: '/settings',
};

const NAVIGATION_LABELS: Readonly<Record<string, string>> = {
  '/today': 'Today',
  '/tasks': 'Tasks',
  '/calendar': 'Calendar',
  '/goals': 'Goals',
  '/habits': 'Habits',
  '/books': 'Books',
  '/lists': 'Lists',
  '/settings': 'Settings',
};

// Sidebar order, which is the order a user has already learned, rather than the
// alphabetical order of the chord keys.
const NAVIGATION_ORDER = [
  '/today',
  '/tasks',
  '/calendar',
  '/goals',
  '/habits',
  '/books',
  '/lists',
  '/settings',
] as const;

function findChordFor(path: string): string | undefined {
  const entry = Object.entries(NAVIGATION_CHORDS).find(([, chordPath]) => chordPath === path);

  return entry?.[0];
}

export function buildCommands({
  navigate,
  toggleTheme,
}: {
  navigate: (to: string) => void;
  toggleTheme: () => void;
}): readonly CommandItem[] {
  const navigationCommands: CommandItem[] = NAVIGATION_ORDER.map((path) => {
    const chordKey = findChordFor(path);

    return {
      id: `navigate:${path}`,
      group: 'Navigate',
      label: NAVIGATION_LABELS[path] ?? path,
      hint: chordKey ? `g ${chordKey}` : undefined,
      run: () => {
        navigate(path);
      },
    };
  });

  return [
    ...navigationCommands,
    {
      id: 'action:new-task',
      group: 'Actions',
      label: 'New task…',
      run: () => 'new-task' as const,
    },
    {
      id: 'action:toggle-theme',
      group: 'Actions',
      label: 'Toggle dark mode',
      run: () => {
        toggleTheme();
      },
    },
  ];
}
```

- [ ] **Step 5: Create the barrel**

Create `apps/just-do-it/src/features/command-palette/index.ts`:

```ts
export { NAVIGATION_CHORDS, buildCommands } from './commands';
export type { CommandGroup, CommandItem, CommandMode } from './types';
```

- [ ] **Step 6: Run the test and watch it pass**

Run: `cd apps/just-do-it && pnpm exec vitest run src/features/command-palette/commands.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 7: Commit**

```bash
cd "/home/nyangi/Bread/Projects/In Progress/indie-mono-repo"
pnpm format
git add apps/just-do-it/src/features/command-palette
git commit -m "feat(palette): define the command list and navigation chords"
```

---

### Task 4: Global shortcuts

**Files:**

- Create: `apps/just-do-it/src/features/command-palette/use-global-shortcuts.ts`
- Create: `apps/just-do-it/src/features/command-palette/use-global-shortcuts.test.tsx`
- Modify: `apps/just-do-it/src/features/command-palette/index.ts`

**Interfaces:**

- Consumes: `NAVIGATION_CHORDS` from Task 3.
- Produces: `useGlobalShortcuts({ onOpenPalette, onNavigate })` — consumed by Task 5.

- [ ] **Step 1: Write the failing test**

Create `apps/just-do-it/src/features/command-palette/use-global-shortcuts.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useGlobalShortcuts } from './use-global-shortcuts';

function Harness({
  onOpenPalette,
  onNavigate,
}: {
  onOpenPalette: () => void;
  onNavigate: (to: string) => void;
}) {
  useGlobalShortcuts({ onNavigate, onOpenPalette });

  return (
    <div>
      <label htmlFor="probe">Probe</label>
      <input id="probe" />
    </div>
  );
}

function setUpUser() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useGlobalShortcuts — opening the palette', () => {
  it('opens on meta+k', async () => {
    const user = setUpUser();
    const onOpenPalette = vi.fn();
    render(<Harness onNavigate={vi.fn()} onOpenPalette={onOpenPalette} />);

    await user.keyboard('{Meta>}k{/Meta}');

    expect(onOpenPalette).toHaveBeenCalled();
  });

  it('opens on control+k too, for non-Mac keyboards', async () => {
    const user = setUpUser();
    const onOpenPalette = vi.fn();
    render(<Harness onNavigate={vi.fn()} onOpenPalette={onOpenPalette} />);

    await user.keyboard('{Control>}k{/Control}');

    expect(onOpenPalette).toHaveBeenCalled();
  });

  // Modified, so it cannot collide with typing — it must work from inside a
  // text field.
  it('opens even while an input is focused', async () => {
    const user = setUpUser();
    const onOpenPalette = vi.fn();
    render(<Harness onNavigate={vi.fn()} onOpenPalette={onOpenPalette} />);

    await user.click(screen.getByLabelText('Probe'));
    await user.keyboard('{Meta>}k{/Meta}');

    expect(onOpenPalette).toHaveBeenCalled();
  });
});

describe('useGlobalShortcuts — navigation chords', () => {
  it('navigates on g then t', async () => {
    const user = setUpUser();
    const onNavigate = vi.fn();
    render(<Harness onNavigate={onNavigate} onOpenPalette={vi.fn()} />);

    await user.keyboard('gt');

    expect(onNavigate).toHaveBeenCalledWith('/today');
  });

  it('maps g k to tasks rather than to today', async () => {
    const user = setUpUser();
    const onNavigate = vi.fn();
    render(<Harness onNavigate={onNavigate} onOpenPalette={vi.fn()} />);

    await user.keyboard('gk');

    expect(onNavigate).toHaveBeenCalledWith('/tasks');
  });

  it('does nothing for g followed by an unmapped key', async () => {
    const user = setUpUser();
    const onNavigate = vi.fn();
    render(<Harness onNavigate={onNavigate} onOpenPalette={vi.fn()} />);

    await user.keyboard('gz');

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('forgets the pending g after the window closes', async () => {
    const user = setUpUser();
    const onNavigate = vi.fn();
    render(<Harness onNavigate={onNavigate} onOpenPalette={vi.fn()} />);

    await user.keyboard('g');
    vi.advanceTimersByTime(1500);
    await user.keyboard('t');

    expect(onNavigate).not.toHaveBeenCalled();
  });

  // The single most important guard: `g` is unmodified, so without this,
  // typing "goals" into any field would navigate away mid-word.
  it('ignores chords while an input is focused', async () => {
    const user = setUpUser();
    const onNavigate = vi.fn();
    render(<Harness onNavigate={onNavigate} onOpenPalette={vi.fn()} />);

    await user.click(screen.getByLabelText('Probe'));
    await user.keyboard('gt');

    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Probe')).toHaveValue('gt');
  });

  it('does not fire a chord when g is modified', async () => {
    const user = setUpUser();
    const onNavigate = vi.fn();
    render(<Harness onNavigate={onNavigate} onOpenPalette={vi.fn()} />);

    await user.keyboard('{Meta>}g{/Meta}t');

    expect(onNavigate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd apps/just-do-it && pnpm exec vitest run src/features/command-palette/use-global-shortcuts.test.tsx`
Expected: FAIL — cannot resolve `./use-global-shortcuts`.

- [ ] **Step 3: Write the hook**

Create `apps/just-do-it/src/features/command-palette/use-global-shortcuts.ts`:

```ts
import { useEffect, useRef } from 'react';

import { NAVIGATION_CHORDS } from './commands';

const CHORD_WINDOW_MS = 1000;

// `g` is an unmodified key, so a chord must never fire while the user is
// typing — otherwise entering "goals" into the quick-add field navigates away
// mid-word.
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable === true
  );
}

export function useGlobalShortcuts({
  onNavigate,
  onOpenPalette,
}: {
  onNavigate: (to: string) => void;
  onOpenPalette: () => void;
}) {
  const pendingChordAtRef = useRef<number | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenPalette();
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        pendingChordAtRef.current = null;
        return;
      }

      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const pendingAt = pendingChordAtRef.current;

      if (pendingAt !== null && Date.now() - pendingAt <= CHORD_WINDOW_MS) {
        pendingChordAtRef.current = null;

        const path = NAVIGATION_CHORDS[key];
        if (path) {
          event.preventDefault();
          onNavigate(path);
        }

        return;
      }

      pendingChordAtRef.current = key === 'g' ? Date.now() : null;
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onNavigate, onOpenPalette]);
}
```

Note the ordering: `g` is itself a mapped chord key (`g g` → Goals), so the pending check must run
_before_ the "should this start a chord" line, or `g g` would only ever re-arm.

- [ ] **Step 4: Export it**

In `apps/just-do-it/src/features/command-palette/index.ts`, add:

```ts
export { useGlobalShortcuts } from './use-global-shortcuts';
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `cd apps/just-do-it && pnpm exec vitest run src/features/command-palette/use-global-shortcuts.test.tsx`
Expected: PASS, 10 tests.

If the "forgets the pending g" test fails, the implementation is probably using a `setTimeout` that
fake timers are advancing differently than expected — the timestamp comparison above avoids that
entirely, which is why it is written that way.

- [ ] **Step 6: Commit**

```bash
cd "/home/nyangi/Bread/Projects/In Progress/indie-mono-repo"
pnpm format
git add apps/just-do-it/src/features/command-palette
git commit -m "feat(palette): add global shortcuts for the palette and navigation"
```

---

### Task 5: The palette container, mounted in the layout

**Files:**

- Create: `apps/just-do-it/src/features/command-palette/command-palette.tsx`
- Create: `apps/just-do-it/src/features/command-palette/command-palette.test.tsx`
- Modify: `apps/just-do-it/src/features/command-palette/index.ts`
- Modify: `apps/just-do-it/src/layouts/app-layout.tsx`

**Interfaces:**

- Consumes: `Command` and `CommandOption` from `@just-do-it/ui` (Task 2); `buildCommands` and `CommandMode` (Task 3); `useGlobalShortcuts` (Task 4); `toQuickAddTaskInput` (Task 1); `parseQuickAdd` and `useCreateTask` from `features/tasks`.
- Produces: `<CommandPalette onToggleTheme={() => void} />`.

- [ ] **Step 1: Write the failing test**

Create `apps/just-do-it/src/features/command-palette/command-palette.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd apps/just-do-it && pnpm exec vitest run src/features/command-palette/command-palette.test.tsx`
Expected: FAIL — cannot resolve `./command-palette`.

- [ ] **Step 3: Write the container**

Create `apps/just-do-it/src/features/command-palette/command-palette.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Command, type CommandOption } from '@just-do-it/ui';
import { parseQuickAdd, toQuickAddTaskInput, useCreateTask } from '../tasks';
import { buildCommands } from './commands';
import type { CommandMode } from './types';
import { useGlobalShortcuts } from './use-global-shortcuts';

export function CommandPalette({ onToggleTheme }: { onToggleTheme: () => void }) {
  const navigate = useNavigate();
  const createTask = useCreateTask();

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<CommandMode>('root');
  const [query, setQuery] = useState('');

  const commands = useMemo(
    () => buildCommands({ navigate, toggleTheme: onToggleTheme }),
    [navigate, onToggleTheme],
  );

  useGlobalShortcuts({
    onNavigate: navigate,
    onOpenPalette: () => {
      setMode('root');
      setQuery('');
      setIsOpen(true);
    },
  });

  function close() {
    setIsOpen(false);
    setMode('root');
    setQuery('');
  }

  if (!isOpen) return null;

  if (mode === 'new-task') {
    const parsed = parseQuickAdd(query);

    return (
      <Command
        ariaLabel="New task"
        emptyLabel="Type a title, and optionally a day, #category or !priority."
        onDismiss={() => {
          setMode('root');
          setQuery('');
        }}
        onQueryChange={setQuery}
        onSelect={() => {
          if (parsed.title.length === 0) return;

          createTask(toQuickAddTaskInput(parsed));
          close();
        }}
        options={
          parsed.title.length > 0
            ? [
                {
                  id: 'quick-add-preview',
                  group: 'Create',
                  label: parsed.title,
                  hint: parsed.dueDate ?? 'No date',
                },
              ]
            : []
        }
        placeholder="Read 20 pages Friday #Reading !high"
        query={query}
      />
    );
  }

  const normalizedQuery = query.trim().toLowerCase();
  const visibleCommands = commands.filter((command) =>
    command.label.toLowerCase().includes(normalizedQuery),
  );
  const options: CommandOption[] = visibleCommands.map((command) => ({
    id: command.id,
    group: command.group,
    label: command.label,
    hint: command.hint,
  }));

  return (
    <Command
      ariaLabel="Command palette"
      emptyLabel="No matching commands"
      onDismiss={close}
      onQueryChange={setQuery}
      onSelect={(optionId) => {
        const command = commands.find((candidate) => candidate.id === optionId);
        if (!command) return;

        const nextMode = command.run();

        if (nextMode) {
          setMode(nextMode);
          setQuery('');
          return;
        }

        close();
      }}
      options={options}
      placeholder="Type a command"
      query={query}
    />
  );
}
```

- [ ] **Step 4: Export it**

In `apps/just-do-it/src/features/command-palette/index.ts`, add:

```ts
export { CommandPalette } from './command-palette';
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `cd apps/just-do-it && pnpm exec vitest run src/features/command-palette/command-palette.test.tsx`
Expected: PASS, 11 tests.

- [ ] **Step 6: Mount it in the layout**

In `apps/just-do-it/src/layouts/app-layout.tsx`, add the import:

```tsx
import { CommandPalette } from '../features/command-palette';
```

Then render it inside the component's returned tree, as the last child of the outermost element, so
the overlay sits above the sidebar and content:

```tsx
<CommandPalette onToggleTheme={() => setDarkMode((current) => !current)} />
```

- [ ] **Step 7: Verify the whole suite**

Run: `cd apps/just-do-it && pnpm exec vitest run`
Expected: PASS. Every existing route test must still pass — the palette renders nothing until it is
opened, so no route test should notice it.

- [ ] **Step 8: Commit**

```bash
cd "/home/nyangi/Bread/Projects/In Progress/indie-mono-repo"
pnpm format
git add apps/just-do-it/src
git commit -m "feat(palette): add the command palette and mount it in the layout"
```

---

### Task 6: Mutation-check the palette

Every branch since the calendar work has done this, and the guards in Task 4 are exactly the kind of
code a test can appear to cover without actually pinning.

**Files:** none changed unless a mutation survives.

- [ ] **Step 1: Run each mutation, one at a time**

For each row: apply the edit, run `cd apps/just-do-it && pnpm exec vitest run`, record whether at
least one test fails, then revert the edit before the next.

| #   | File                      | Change                                                                        | Must be caught by                                   |
| --- | ------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | `use-global-shortcuts.ts` | delete the `if (isTypingTarget(event.target)) return;` line                   | "ignores chords while an input is focused"          |
| 2   | `use-global-shortcuts.ts` | `CHORD_WINDOW_MS = 1000` → `600000`                                           | "forgets the pending g after the window closes"     |
| 3   | `use-global-shortcuts.ts` | drop `event.metaKey                                                           |                                                     | ` from the ⌘K check | "opens on meta+k" |
| 4   | `commands.ts`             | in `NAVIGATION_CHORDS`, swap `k: '/tasks'` to `k: '/today'`                   | "maps g k to tasks rather than to today"            |
| 5   | `command-palette.tsx`     | make `onSelect` in root mode always `close()` instead of honouring `nextMode` | "switches into quick-add mode without closing"      |
| 6   | `command-palette.tsx`     | drop the `parsed.title.length === 0` guard in new-task `onSelect`             | "does not create a task with no title"              |
| 7   | `command-palette.tsx`     | make new-task `onDismiss` call `close()` instead of `setMode('root')`         | "steps back to the command list on Escape"          |
| 8   | `command.tsx`             | `moveActiveIndex` drops the `% options.length` wrap                           | "wraps from the last option back to the first"      |
| 9   | `command.tsx`             | delete the cleanup that restores focus on unmount                             | "returns focus where it came from when it unmounts" |

- [ ] **Step 2: Deal with any survivor**

A survivor means one of two things, and they need opposite responses:

- **The behaviour is genuinely untested** — add the missing test.
- **The mutated line cannot change behaviour** — it is unreachable or duplicated. Do not invent a
  test to chase it. Record it in `just-do-it-implementation-plan.md` §6 under the existing
  "Route-level guards" entry, which already catalogues seven of these.

Say which of the two it was in the commit message.

- [ ] **Step 3: Commit only if something changed**

```bash
cd "/home/nyangi/Bread/Projects/In Progress/indie-mono-repo"
pnpm format
git add -A
git commit -m "test(palette): close the gaps the mutation check found"
```

---

### Task 7: Document it

**Files:**

- Modify: `CLAUDE.md`
- Modify: `just-do-it-implementation-plan.md`

- [ ] **Step 1: Add a shortcuts section to `CLAUDE.md`**

Under the "Architecture" heading, after the "Design system" subsection, add:

```markdown
### Keyboard shortcuts

`features/command-palette` owns the only global key listener in the app; `AppLayout` mounts
`<CommandPalette />` once and passes it the theme setter. `⌘K` / `Ctrl-K` opens the palette from
anywhere, including from inside a text field, because it is modified and so cannot collide with
typing.

Navigation chords are `g` then a key: `t` Today, `k` Tasks, `c` Calendar, `g` Goals, `h` Habits,
`b` Books, `l` Lists, `s` Settings. `k` rather than `t` for Tasks because Today claims `t`.
`NAVIGATION_CHORDS` in `commands.ts` is the single source of truth — `buildCommands` reads it to
advertise each hint, so a route can never be offered under a chord that does not work.

**Chords are suppressed whenever the event target is an `input`, `textarea`, or contenteditable.**
Without that guard, typing "goals" into the quick-add field navigates away mid-word. Any new
unmodified shortcut needs the same guard.

The palette's active option is tracked with `aria-activedescendant` rather than by moving DOM
focus, so typing keeps working while arrowing through results.
```

- [ ] **Step 2: Tick the boxes in the plan**

In `just-do-it-implementation-plan.md`, under "Phase 12 — Quick add & command surface", change the
three unticked boxes to:

```markdown
- [x] Command palette (⌘K) — `Command` in `packages/ui`, wired up by `features/command-palette`
- [x] Keyboard shortcuts for new task, search, and navigation — ⌘K plus `g`-then-key chords
- [x] Make quick add reachable from every route — as the palette's "New task…" command, rather than
      a persistent field in the shell
```

Change the heading from `(partial)` to `✅`, and add a closing paragraph to that section:

```markdown
The command surface shipped without entity search: typing "atomic" does not find the book. The
`CommandItem` shape and the primitive are built so a `search` group can be added without reworking
either. See `docs/superpowers/specs/2026-08-30-command-palette-design.md`.
```

- [ ] **Step 3: Refresh the test counts**

Update the count in `CLAUDE.md` and in the plan's §6 "Test coverage" entry to whatever
`pnpm --filter @just-do-it/app exec vitest run` reports. Do not guess the number — read it.

- [ ] **Step 4: Commit**

```bash
cd "/home/nyangi/Bread/Projects/In Progress/indie-mono-repo"
pnpm format
git add CLAUDE.md just-do-it-implementation-plan.md
git commit -m "docs(palette): record the shortcut map and close out Phase 12"
```

---

## Final verification

Run all five gates from the repo root, uncached:

```bash
cd "/home/nyangi/Bread/Projects/In Progress/indie-mono-repo"
pnpm format:check
pnpm lint --force
pnpm typecheck --force
pnpm test --force
pnpm build --force
```

All five must pass.

**A visual check is required for this branch**, unlike the test-only branches before it — this adds
a visible surface, and no test can tell you the overlay sits above the sidebar or that the dark
theme tokens read correctly:

```bash
CHOKIDAR_USEPOLLING=1 CHOKIDAR_INTERVAL=1000 \
  pnpm --filter @just-do-it/app exec vite --host 127.0.0.1 --port 5173
```

Open `/today`, press ⌘K, check the overlay in both themes, arrow through the list, run a navigation
command, and run "New task…". If browser tooling is unavailable in the implementing session, say so
explicitly in the PR rather than implying the palette was seen.
