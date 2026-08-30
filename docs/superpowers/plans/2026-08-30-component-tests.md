# Route and Component Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a rendering test layer — jsdom plus Testing Library — and prove it with a behaviour-deep test file for the calendar route, covering the grid logic no pure-function test can reach.

**Architecture:** The environment is chosen per file by a `// @vitest-environment jsdom` docblock, so the 254 existing node tests stay in node and unchanged. A shared setup file registers jest-dom matchers, cleans up after each test, and resets the module-singleton zustand stores. Tests query by role and accessible name, and pin the clock because the calendar route reads `new Date()` directly.

**Tech Stack:** React 19, vitest 4.1, jsdom, @testing-library/react 16, @testing-library/user-event 14, @testing-library/jest-dom 7, React Router 7, pnpm 10 + Turborepo.

**Spec:** `docs/superpowers/specs/2026-08-30-component-tests-design.md`

## Global Constraints

- **Run every command from the repo root**, not from `apps/just-do-it`.
- **Run `pnpm format` before every commit.** No pre-commit hook exists; CI fails on Prettier drift. Style: semicolons, single quotes, trailing commas, 100 columns.
- **No production code may change.** This branch adds tests and configuration only. Nothing under `src/routes/` or `src/features/` is modified. If a test cannot be written without changing the route, stop and report it — that is a finding, not a licence to refactor.
- **The 254 pre-existing tests must still pass** at every step. They run in the `node` environment and must stay there.
- **Variable names are spelled out in full.** No single-letter or abbreviated identifiers.
- **Tests query by role and accessible name.** No test IDs, no class selectors, no `container.querySelector`.
- **Test expectations are hand-written literals**, never computed with the code under test.
- **Conventional Commits scoped by domain**, e.g. `test(calendar):`, `chore(test):`. Branch `feat/component-tests` already exists and is checked out.
- `pnpm dev` fails on this machine with `ENOSPC`; do not attempt a browser check.

### The time-pinning contract — both halves are required

`CalendarPage` initialises `visibleMonth` and `selectedDate` from `new Date()` and takes no injectable `now`. Every test that renders it must pin the clock:

```ts
vi.useFakeTimers({ shouldAdvanceTime: true });
vi.setSystemTime(new Date(2026, 11, 15));

const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
```

`user-event` waits on real timers internally; under plain fake timers it **hangs**. `shouldAdvanceTime: true` plus the `advanceTimers` bridge is what keeps clicks working. This was established by probe — it is a requirement, not a preference. `vi.useRealTimers()` runs in `afterEach`.

### What enforces cleanup

`.oxlintrc.json` enables only `react/rules-of-hooks` and `react/only-export-components` — it does **not** flag unused imports. `tsconfig.app.json` sets `noUnusedLocals` and `noUnusedParameters`, so `pnpm typecheck` is what fails on a leftover import, with `TS6133`.

---

### Task 1: Install the test environment and wire it up

**Files:**

- Modify: `apps/just-do-it/package.json` (four dev dependencies)
- Modify: `apps/just-do-it/vitest.config.ts` (add `setupFiles`)
- Create: `apps/just-do-it/src/test/setup.ts`

**Interfaces:**

- Consumes: `getInitialTasks`, `getInitialHabits`, `getInitialHabitCompletions`, `getInitialGoals`, `getInitialBooks`, `getInitialLists` and the five stores, all via their feature barrels.
- Produces: a jsdom environment available per file via `// @vitest-environment jsdom`, jest-dom matchers registered globally, automatic RTL cleanup, and a per-test store reset. Task 2 relies on all of these.

- [ ] **Step 1: Install the dependencies**

From the repo root:

```sh
pnpm --filter @just-do-it/app add -D jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

This took **over five minutes** on the development machine and timed out twice at shorter limits. Let it run to completion; do not interrupt it and retry.

- [ ] **Step 2: Verify the existing suite still passes before changing any config**

```sh
pnpm test
```

Expected: **254 passed**. Installing dependencies must not move that number. If it does, stop and report — something else has changed.

- [ ] **Step 3: Create the setup file**

Create `apps/just-do-it/src/test/setup.ts`:

```ts
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
```

**Verify the exact export names before writing this file.** Read each feature's `index.ts` and confirm every `getInitialX` and `useXStore` name matches. The habit store's state keys (`habits`, `completions`) must match its actual store shape — read `features/habits/habit-store.ts` to confirm. If any name differs, use the real one and note the difference in your report.

This file loads for **every** test, including the 254 that run in `node`. `cleanup()` is safe to call with no DOM (RTL no-ops when nothing is mounted), and the jest-dom import only registers matchers. If either turns out to break the node tests, that is the finding this task exists to catch.

- [ ] **Step 4: Wire the setup file into the vitest config**

Modify `apps/just-do-it/vitest.config.ts`. Keep `environment: 'node'` as the default — individual test files opt into jsdom with a docblock:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.?(c|m)[jt]s?(x)'],
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

- [ ] **Step 5: Verify the 254 node tests survive the setup file**

```sh
pnpm test
```

Expected: **254 passed**, unchanged. This is the main regression risk in the whole branch — the setup file now runs for every node test. If anything fails here, report exactly which test and why rather than working around it.

- [ ] **Step 6: Prove jsdom is reachable per file**

Create `apps/just-do-it/src/test/environment.test.tsx` as a permanent, minimal guard that the infrastructure works:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('the jsdom test environment', () => {
  it('provides a document', () => {
    expect(typeof document).toBe('object');
  });

  it('renders a React element and finds it by role', () => {
    render(<button type="button">Ready</button>);

    expect(screen.getByRole('button', { name: 'Ready' })).toBeInTheDocument();
  });
});
```

`toBeInTheDocument` comes from jest-dom; if it is not a function, Step 3's import is wrong.

- [ ] **Step 7: Run the full gate**

```sh
pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: all green, **256 tests** (254 + the 2 new environment tests).

- [ ] **Step 8: Commit**

```bash
git add apps/just-do-it/package.json apps/just-do-it/vitest.config.ts \
        apps/just-do-it/src/test/ pnpm-lock.yaml
git commit -m "chore(test): add jsdom and Testing Library"
```

Run this from the repo root, where `pnpm-lock.yaml` sits. `git status` should show nothing left but the untracked `HANDOVER.md`, which is a scratch file and must stay untracked.

---

### Task 2: Test the calendar route

**Files:**

- Create: `apps/just-do-it/src/routes/calendar-page.test.tsx`

**Interfaces:**

- Consumes: the jsdom environment, jest-dom matchers, cleanup and store reset from Task 1.
- Produces: no API. A test file proving the calendar grid, month navigation, day selection and agenda toggle behave as the UI claims.

Everything below is pinned to **15 December 2026**, a Tuesday. That month's grid was measured by probe: **35 day cells, first `Monday, November 30, 2026`, last `Sunday, January 3, 2027`** — it spills into both adjacent months and crosses a year boundary.

- [ ] **Step 1: Write the test file**

Create `apps/just-do-it/src/routes/calendar-page.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CalendarPage } from './calendar-page';

// Tuesday 15 December 2026. The calendar reads the real clock, so every test
// pins it — otherwise these assertions rot the moment the month turns.
const pinnedNow = new Date(2026, 11, 15);

function renderCalendar() {
  return render(
    <MemoryRouter>
      <CalendarPage />
    </MemoryRouter>,
  );
}

// Day cells are the buttons whose accessible name begins with a weekday, e.g.
// "Monday, November 30, 2026. No scheduled items". Month navigation buttons are
// named "Show <Month> <Year>" and are excluded by that pattern.
function getDayCells() {
  return screen
    .getAllByRole('button')
    .filter((button) => /^\w+day, /u.test(button.getAttribute('aria-label') ?? ''));
}

function getDayCellLabels() {
  return getDayCells().map((button) => button.getAttribute('aria-label') ?? '');
}

function setUpUser() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(pinnedNow);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CalendarPage — the month grid', () => {
  it('opens on the month containing today', () => {
    renderCalendar();

    expect(screen.getByRole('heading', { name: 'December 2026' })).toBeInTheDocument();
  });

  it('renders whole weeks, so the grid is a multiple of seven', () => {
    renderCalendar();

    expect(getDayCells()).toHaveLength(35);
  });

  it('starts the grid on the Monday before the first of the month', () => {
    renderCalendar();

    expect(getDayCellLabels()[0]).toMatch(/^Monday, November 30, 2026\./u);
  });

  it('ends the grid on the Sunday after the last of the month', () => {
    renderCalendar();

    expect(getDayCellLabels().at(-1)).toMatch(/^Sunday, January 3, 2027\./u);
  });

  it('spills into both adjacent months rather than clipping to December', () => {
    renderCalendar();

    const labels = getDayCellLabels();

    // The label reads "Monday, November 30, 2026. …", so the month and year are
    // not adjacent — match the month name and the year separately.
    expect(labels.some((label) => /November \d+, 2026/u.test(label))).toBe(true);
    expect(labels.some((label) => /January \d+, 2027/u.test(label))).toBe(true);
  });
});

describe('CalendarPage — month navigation', () => {
  it('crosses the year boundary from December 2026 to January 2027', async () => {
    const user = setUpUser();
    renderCalendar();

    await user.click(screen.getByRole('button', { name: 'Show January 2027' }));

    expect(screen.getByRole('heading', { name: 'January 2027' })).toBeInTheDocument();
  });

  it('steps backwards from December 2026 to November 2026', async () => {
    const user = setUpUser();
    renderCalendar();

    await user.click(screen.getByRole('button', { name: 'Show November 2026' }));

    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeInTheDocument();
  });
});

describe('CalendarPage — the agenda', () => {
  it('describes the selected day while in day mode', () => {
    renderCalendar();

    expect(screen.getByText('A concise view for December 15.')).toBeInTheDocument();
  });

  it('widens to the surrounding week when the week toggle is pressed', async () => {
    const user = setUpUser();
    renderCalendar();

    await user.click(screen.getByRole('button', { name: 'Week' }));

    // 15 December 2026 is a Tuesday; Monday-first weeks put it in Dec 14-20.
    expect(screen.getByText('Simple week view for Dec 14 – Dec 20.')).toBeInTheDocument();
  });

  it('marks the active mode with aria-pressed', async () => {
    const user = setUpUser();
    renderCalendar();

    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Week' }));

    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('follows the day that was clicked', async () => {
    const user = setUpUser();
    renderCalendar();

    const targetCell = getDayCells().find((button) =>
      (button.getAttribute('aria-label') ?? '').startsWith('Friday, December 18, 2026'),
    );
    if (!targetCell) throw new Error('expected a cell for Friday 18 December 2026');

    await user.click(targetCell);

    expect(screen.getByText('A concise view for December 18.')).toBeInTheDocument();
  });
});
```

**The em-dash in `'Simple week view for Dec 14 – Dec 20.'` is an en dash (`–`, U+2013), copied from the route.** Match it exactly or the query will not find the text.

- [ ] **Step 2: Run the new file**

```sh
pnpm --filter @just-do-it/app exec vitest run src/routes/calendar-page.test.tsx
```

Expected: **11 passed**. If a query finds nothing, read the rendered output with `screen.debug()` before changing the assertion — the route is correct and must not be edited.

- [ ] **Step 3: Run the full gate**

```sh
pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: all green, **267 tests** (256 + 11).

- [ ] **Step 4: Confirm no production code changed**

```sh
git diff --stat main -- apps/just-do-it/src/routes/calendar-page.tsx apps/just-do-it/src/features/
```

Expected: **no output**. This branch adds tests and configuration only. Any diff here means the route was edited to make a test pass, which is forbidden.

- [ ] **Step 5: Commit**

```bash
git add apps/just-do-it/src/routes/calendar-page.test.tsx
git commit -m "test(calendar): cover the grid, navigation and agenda"
```

---

### Task 3: Mutation-check the calendar tests

The tests in Task 2 were written against a working page, so they passed on the first run. That proves they execute the page, not that they can fail. **This repo has been bitten twice by exactly that gap** — the quick-add parser caught 9 of 9 mutations and still shipped a data-loss bug, and the calendar selectors caught 13 of 13 while two functions were year-blind to their fixtures. Treat this as a floor, not a ceiling.

**Files:**

- Modify: `apps/just-do-it/src/routes/calendar-page.test.tsx` (only if a mutation survives)

**Interfaces:**

- Consumes: the page and the suite from Tasks 1-2.
- Produces: a suite demonstrated to detect a wrong page.

- [ ] **Step 1: Back up the route**

```bash
cp apps/just-do-it/src/routes/calendar-page.tsx /tmp/calendar-page.backup.tsx
```

- [ ] **Step 2: Apply each mutation, run the suite, restore**

Per mutation: make the edit, run
`pnpm --filter @just-do-it/app exec vitest run src/routes/calendar-page.test.tsx`,
record CAUGHT or SURVIVED and which test failed, then
`cp /tmp/calendar-page.backup.tsx apps/just-do-it/src/routes/calendar-page.tsx`.

| #   | Mutation                                                                                                                                                                                        | Should be caught by                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | `const weekStartsOn = 1` → `0`                                                                                                                                                                  | "starts the grid on the Monday before the first of the month"       |
| 2   | In the `calendarDays` memo, replace `startOfWeek(startOfMonth(visibleMonth), …)` / `endOfWeek(endOfMonth(visibleMonth), …)` with bare `startOfMonth(visibleMonth)` / `endOfMonth(visibleMonth)` | "spills into both adjacent months rather than clipping to December" |
| 3   | In the month-change handler, `addMonths(visibleMonth, offset)` → `addMonths(visibleMonth, offset * 2)`                                                                                          | "crosses the year boundary from December 2026 to January 2027"      |
| 4   | In the `agendaRange` memo, make the `'week'` branch return `{ start: selectedDate, end: selectedDate }`                                                                                         | "widens to the surrounding week when the week toggle is pressed"    |
| 5   | In the day-cell click handler, ignore the clicked date and keep the current selection                                                                                                           | "follows the day that was clicked"                                  |
| 6   | `aria-pressed={active}` → `aria-pressed={false}` in `AgendaToggleButton`                                                                                                                        | "marks the active mode with aria-pressed"                           |

Mutation 3 is the sharp one: the button's accessible name is computed separately from the handler, so under it the label still reads "Show January 2027" while the click lands on February. A test that only asserted the button exists would pass.

- [ ] **Step 3: Close any gap**

If a mutation SURVIVED, write a test that fails under it, in the existing file's style — role-and-name queries, hand-written literal expectations, the shared `pinnedNow`. Re-apply the mutation to confirm the new test catches it, then restore.

- [ ] **Step 4: Confirm the route is back to its committed state**

```bash
git diff --exit-code apps/just-do-it/src/routes/calendar-page.tsx
```

Expected: no output, exit code 0. If this prints a diff, a mutation was left behind — restore from the backup.

- [ ] **Step 5: Run the full gate, and commit only if tests were added**

```sh
pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

If Step 3 added tests:

```bash
git add apps/just-do-it/src/routes/calendar-page.test.tsx
git commit -m "test(calendar): close coverage gaps found by mutation"
```

If no mutation survived, there is nothing to commit. Say so and move on.

---

### Task 4: Record the new test layer

**Files:**

- Modify: `CLAUDE.md`
- Modify: `just-do-it-implementation-plan.md`

**Interfaces:**

- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Update CLAUDE.md's coverage paragraph**

The bullet beginning "**`pnpm test` runs vitest, and coverage is selector- and store-deep but UI-blind**" says no route or component has a test. That is now false. Rewrite it to state the real position: the suite covers every domain's selectors and stores, the quick-add parser, the calendar mapping, **and** the calendar route's rendering; the remaining untested routes are the other eight.

Add a short paragraph naming the conventions a future component test must follow, because they are not guessable:

```markdown
Component and route tests opt into jsdom per file with a `// @vitest-environment jsdom` docblock —
the default environment stays `node` so the pure-logic suites stay fast. `src/test/setup.ts`
registers jest-dom matchers, cleans up after each test, and resets every zustand store, since the
stores are module singletons that otherwise leak between tests in a file. Query by role and
accessible name; the routes already carry good ones. Any test that renders `CalendarPage` must pin
the clock with `vi.useFakeTimers({ shouldAdvanceTime: true })` and bridge it into user-event with
`userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` — the page reads `new Date()`
directly, and user-event hangs on unbridged fake timers.
```

- [ ] **Step 2: Update the roadmap**

In `just-do-it-implementation-plan.md`, Phase 15's checkbox `- [ ] React Testing Library for Today and Tasks` is partially satisfied — the library is in and proven, but on the calendar route rather than Today and Tasks. Do **not** tick it. Reword it to reflect reality:

```markdown
- [ ] React Testing Library — installed and proven on `/calendar`; Today, Tasks and the other six
      routes are still unrendered by any test
```

Update §2's architecture table Tests row and §6's coverage bullet to the new total, and drop any claim that no route or component is tested. **Do not** tick "Extend oxlint to `packages/ui`" — still undone.

- [ ] **Step 3: Verify and commit**

```sh
pnpm format && pnpm format:check
```

```bash
git add CLAUDE.md just-do-it-implementation-plan.md
git commit -m "docs(test): record the rendering test layer and its conventions"
```

---

## Final verification

- [ ] `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build` green from the repo root.
- [ ] The 254 pre-existing tests still pass, unchanged.
- [ ] Every mutation in Task 3 caught.
- [ ] `git diff --stat main -- apps/just-do-it/src/routes/calendar-page.tsx apps/just-do-it/src/features/` prints nothing — no production code changed.
- [ ] Push and open a PR against `main`. Branch protection requires the **Verify** check.
