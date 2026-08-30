# Route and component tests — design

Date: 2026-08-30
Phase: 15 (`just-do-it-implementation-plan.md` §7) — React Testing Library
Branch: `feat/component-tests`

## Problem

The repo has 254 tests and **not one of them renders anything**. There are zero `.test.tsx` files,
`vitest.config.ts` sets `environment: 'node'`, and neither jsdom nor Testing Library is installed.
Every domain's selectors and stores are covered; the UI that consumes them is not.

Two consequences have already been paid for:

- The quick-add field shipped in PR #18 with **no verification beyond the human's eyes**. Mount and
  data flow were checked by server-rendering it; chip styling, Enter-to-submit and the preview's
  screen-reader behaviour were not.
- The calendar-selectors spec (2026-08-27) enumerated eight test requirements and **two were
  unsatisfiable**: "a date outside the displayed month" and "a month whose grid spills into
  adjacent months". That logic — `eachDayOfInterval`, `startOfWeek`, `endOfWeek` — lives in
  `useMemo` blocks inside `routes/calendar-page.tsx` and cannot be reached without rendering.

This phase stands up the rendering layer and proves it on the hardest route.

## Scope

**In scope:** jsdom, Testing Library, a shared setup file, and one behaviour-deep test file for
`routes/calendar-page.tsx`.

**Out of scope, deliberately:**

- **The other eight routes.** Infrastructure first, breadth later. A smoke test asserting each
  route mounts would pass whatever the UI does and add little beyond what `typecheck` and `build`
  already prove.
- **`QuickAddField`.** It deserves a component test and will get one, but this branch is scoped to
  establishing the pattern on one route.
- **Extracting the calendar `useMemo` bodies into pure functions.** That was the alternative to
  this whole approach and was rejected: it would cover the grid arithmetic while leaving rendering
  permanently untested, and would make these tests thinner.
- **Any production code change.** The route is not modified. If a test cannot be written without
  changing the route, that is a finding to report, not a licence to refactor.

## Decisions

Settled during brainstorming and by a throwaway probe, recorded so the implementation does not
relitigate them:

1. **The environment is selected per file by docblock**, not globally:

   ```ts
   // @vitest-environment jsdom
   ```

   The 254 existing tests keep running in `node` — faster, and untouched. `environmentMatchGlobs`
   was **removed in vitest 4**; the surviving alternatives are this docblock and `projects`.
   `projects` is the heavier tool and earns nothing until there are many DOM files.

2. **Four dev dependencies:** `jsdom`, `@testing-library/react`, `@testing-library/user-event`,
   `@testing-library/jest-dom`. This is the largest dependency addition the repo has taken. Note
   that `pnpm add` for these took **over five minutes** on the development machine; a cold CI cache
   will wear that cost on every run until it warms.

3. **`<MemoryRouter>` is sufficient.** The probe rendered `CalendarPage` inside one with no
   `AppLayout` context and no error. Tests do not need the layout shell.

4. **Tests query by role and accessible name.** No test IDs, no class selectors. The route already
   produces good names — `getDayButtonLabel` yields
   `"Sunday, January 3, 2027. No scheduled items"`, and month navigation yields
   `"Show January 2027"` — so the tests read like a user's description of the page and survive
   restyling.

5. **Time must be pinned, and this is not optional.** `CalendarPage` initialises `visibleMonth` and
   `selectedDate` from `new Date()` with no injectable `now`. Rendered bare during the probe it
   displayed "Tasks for August 30" — the real date. Tests written against the live clock would be
   green this month and red the next.

## The time-pinning contract

Every test in the new file pins the clock. The exact form matters:

```ts
vi.useFakeTimers({ shouldAdvanceTime: true });
vi.setSystemTime(new Date(2026, 11, 15));

const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
```

**Both halves are load-bearing.** `user-event` waits on real timers internally; under plain fake
timers it hangs. `shouldAdvanceTime: true` plus the `advanceTimers` bridge is what keeps clicks
working. This pairing is non-obvious and cost a probe to establish — it is a requirement, not a
style preference.

`vi.useRealTimers()` runs in `afterEach`.

## Test environment setup

New `apps/just-do-it/src/test/setup.ts`, registered via `setupFiles` in `vitest.config.ts`. It
does three things:

1. Registers `@testing-library/jest-dom` matchers.
2. `afterEach(cleanup)` — RTL does not auto-clean when vitest globals are off.
3. **Resets every zustand store.** The stores are module-level singletons seeded from fixtures, so
   a test that creates a task pollutes every later test in the same file. Reset all five in
   `beforeEach` from their `getInitialX()` functions, following the pattern `goal-store.test.ts`
   already uses. Vitest isolates modules per file, so cross-file leakage is not a concern —
   within-file leakage is.

`vitest.config.ts` keeps `environment: 'node'` as the default and gains `setupFiles`. The setup
file must be safe to load in a node environment, since it will run for the existing 254 tests too:
guard anything DOM-dependent, or accept that `cleanup` and the jest-dom import are inert there.
**Verify the 254 node tests still pass after wiring `setupFiles`** — that is the main regression
risk in this phase.

## What the calendar tests assert

`apps/just-do-it/src/routes/calendar-page.test.tsx`, five to eight tests, all pinned to
**15 December 2026** unless stated:

| Test                     | Assertion                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| Grid spans whole weeks   | 35 day cells, first `Monday, November 30, 2026`, last `Sunday, January 3, 2027` — verified by probe |
| Grid spills both sides   | Cells exist for November and January, so the month is not clipped to its own days                   |
| Year-boundary navigation | Clicking "Show January 2027" changes the heading to January 2027 — verified by probe                |
| Day selection            | Clicking a day cell updates the agenda heading to that date                                         |
| Day/week toggle          | Switching to week widens the listed range beyond the single selected day                            |
| Empty state              | A day with no items shows the empty-state copy                                                      |

The first three are the two requirements the calendar-selectors spec could not satisfy, plus the
year boundary that was invisible to the selector suite.

## Testing the tests

These are characterization tests over working UI, so they will pass on the first run. That proves
they execute the page, not that they can fail. **This repo has been bitten twice by exactly that**:
the quick-add parser caught 9 of 9 mutations and still shipped a data-loss bug, and the calendar
selectors caught 13 of 13 while two functions were year-blind to their fixtures.

So each test must be shown to fail against a plausible wrong page. Mutations to apply to
`calendar-page.tsx`, reverting after each:

1. `weekStartsOn: 1` → `0` — the grid test must fail (first cell becomes a Sunday).
2. `eachDayOfInterval` bounds → `startOfMonth`/`endOfMonth` instead of `startOfWeek`/`endOfWeek` —
   the spill test must fail.
3. In the month-change handler (`calendar-page.tsx:283`), `addMonths(visibleMonth, offset)` →
   `addMonths(visibleMonth, offset * 2)` — the navigation test must fail. This is a sharp mutation:
   the button's accessible name is computed separately at line 381, so the label still reads
   "Show January 2027" while the click lands on February. A test that only asserted the button
   exists would pass; one that asserts the heading afterwards will not.
4. The agenda range for `'week'` → return the day range — the toggle test must fail.

Any mutation that survives marks a test as decorative; fix the test, not the mutation.

## Verification

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all green.
- **The 254 pre-existing tests still pass**, unchanged, after `setupFiles` is wired.
- Every mutation above is caught.
- No file under `src/routes/` or `src/features/` is modified — this branch adds tests and
  configuration only. Confirm with `git diff --stat` before committing.
