# Habits as a first-class domain — design

Date: 2026-08-17
Phase: 13 (`just-do-it-implementation-plan.md` §7)
Branch: `feat/habits-domain`

## Problem

`Habit` is `{ id, label, days: boolean[] }` with `HABIT_DAY_COUNT = 5` hard-coded and Zod
enforcing `.length(5)`. No dates are attached to a completion, so streaks, frequency, targets
and real history are all unreachable. The calendar fakes history by mapping array slots onto
dates relative to an anchor (`createHabitActivityMap(habits, anchorDate)`) — the displayed
"habit activity" is positional, not recorded.

The plan always called for a separate `habit_completions` record keyed by date, explicitly so
that metrics like weekly workout counts are possible. This phase builds that. It must land
before Phase 16 (Supabase): migrating a positional array into a completions table after a
backend exists is strictly harder than doing it while all state is fixtures.

## Decisions

Settled during brainstorming, recorded here so the implementation doesn't relitigate them:

1. **A completion is binary per day.** One completion record per habit per calendar day, at
   most. Not countable — no "8 glasses of water". `target` therefore means _days per period_,
   never _times per day_.
2. **Frequency vocabulary is `daily | weekly`.** No custom day-of-week sets.
3. **The whole phase ships on one branch**, in five commits (see Work breakdown).
4. **vitest is pulled forward from Phase 15**, scoped to the habit selectors only. Streak logic
   is the first genuinely non-trivial pure logic in this repo and is not verifiable by a green
   build.

## Data model

Two collections, mirroring the two planned backend tables.

```ts
// features/habits/types.ts
export const HABIT_FREQUENCY_VALUES = ['daily', 'weekly'] as const;
export type HabitFrequency = (typeof HABIT_FREQUENCY_VALUES)[number];

export type Habit = {
  id: string;
  label: string;
  description?: string;
  frequency: HabitFrequency;
  target: number; // weekly: qualifying days per week, 1-7. daily: always 1.
  createdAt: string; // 'YYYY-MM-DD'
};

export type HabitCompletion = {
  id: string;
  habitId: string;
  date: string; // 'YYYY-MM-DD', local calendar day
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
```

`HABIT_DAY_COUNT` and `days: boolean[]` are deleted, not deprecated.

Dates are `YYYY-MM-DD` strings matching `Task.dueDate`, parsed with `parseISO` (local midnight).
A completion carries no time component: two check-ins on the same day are the same completion.

### Zod invariants (`habit-data.ts`)

Beyond shape, three refinements — they matter because stores re-`parse()` on every mutation, so
these hold against feature code as well as against the fixture:

- `frequency === 'daily'` implies `target === 1`.
- `target` is an integer in `1..7`.
- The completion _list_ schema refines that `(habitId, date)` is unique across the array.

A malformed fixture throws at import, at app boot, not at render.

Referential integrity between the two collections (`completion.habitId` must name a real habit)
is **not** expressed in Zod — the two fixtures are parsed independently. It is enforced in the
store's actions instead, which is where the pairing actually exists.

## Selectors

`features/habits/habit-selectors.ts`. All pure functions over `readonly` arrays, never hooks,
with an injectable `now = new Date()` wherever date logic is involved — per the existing
convention.

| Selector                        | Signature                                     | Returns                                                        |
| ------------------------------- | --------------------------------------------- | -------------------------------------------------------------- |
| `isHabitCompletedOn`            | `(completions, habitId, dateKey)`             | `boolean`                                                      |
| `selectCompletionDatesForHabit` | `(completions, habitId)`                      | `Set<string>` — index helper                                   |
| `selectHabitCompletionsByDate`  | `(completions)`                               | `Map<string, string[]>` — dateKey → habitIds, for the calendar |
| `selectCurrentStreak`           | `(habit, completions, now?)`                  | `number`                                                       |
| `selectLongestStreak`           | `(habit, completions)`                        | `number`                                                       |
| `selectCompletionRate`          | `(habit, completions, now?, windowDays = 30)` | `number` in `0..1`                                             |
| `selectPeriodProgress`          | `(habit, completions, now?)`                  | `{ completed: number; target: number }`                        |
| `selectRecentCompletionDays`    | `(completions, habitId, dayCount, now?)`      | `{ date: Date; complete: boolean }[]`                          |

The streak unit differs by frequency: **days** for `daily`, **qualifying weeks** for `weekly`.
A caller rendering "12" must therefore label it using the habit's frequency; the selector does
not return a unit.

### Streak rules

Stated explicitly because this is the part that can be silently wrong.

**Daily.** Walk backwards a day at a time from today. If today is not yet complete, start from
yesterday instead — a day still in progress must not break a streak (otherwise every streak in
the app reads as 0 every morning). Stop at the first missed day. Count the completed days
walked.

**Weekly.** Bucket completions into Monday-first weeks (`startOfWeek(date, { weekStartsOn: 1 })`,
matching the calendar page's Monday-first grid). A week qualifies when its completion count is
`>= target`. Walk backwards a week at a time from the current week; if the current week has not
yet reached target, start from the previous week — the same grace, for the same reason. Count
qualifying weeks.

Note that 2026-08-17 is a Monday, so on the fixture's "today" the current week holds at most one
day. The weekly grace rule is load-bearing on the shipped demo data, not a theoretical edge case.

**Longest.** The maximum run over all recorded history, in the same unit, with **no** grace rule
— grace exists only to protect a period that is still in progress, and no historical period is.

**Empty history.** Every streak selector returns `0`; `selectCompletionRate` returns `0`.

### Completion rate

A 30-day window ending today, clamped so it never begins before the habit's `createdAt` — a
habit created three days ago should not report a 10% rate.

- `daily`: completed days ÷ eligible days.
- `weekly`: completed days ÷ (`target` × eligible weeks), capped at 1 — a week that overshoots
  target does not lend credit to a week that missed.

Eligible days and eligible weeks are floored at 1, so a habit created today divides by 1 rather
than by 0. Rate is `0` for a habit with no completions, never `NaN`.

## Store

One `useHabitStore` holding both collections. Two stores would split an invariant that spans
them (removing a habit must remove its completions).

```ts
type HabitStoreState = {
  habits: Habit[];
  completions: HabitCompletion[];
  toggleHabitCompletionOn: (habitId: string, dateKey: string) => void;
  addHabit: (input: HabitInput) => void;
  updateHabit: (habitId: string, input: HabitUpdateInput) => void;
  removeHabit: (habitId: string) => void;
};
```

- `toggleHabitCompletionOn` is idempotent by construction: if a completion exists for
  `(habitId, dateKey)` it is removed, otherwise one is appended with `crypto.randomUUID()`.
  This is what makes the uniqueness invariant unbreakable from feature code. It is a no-op when
  `habitId` names no habit.
- `removeHabit` drops the habit **and** every completion referencing it.
- Every write goes through `buildHabitRecord()` / `buildHabitCompletionRecord()`, which
  re-`parse()` through the Zod schema — matching tasks and lists.
- The positional actions `setHabitCompletion(habitId, dayIndex, complete)` and
  `toggleHabitCompletion(habitId, dayIndex)` are removed. A day index is precisely the thing
  this phase deletes.

Hooks (`hooks.ts`) stay thin wrappers: `useHabits`, `useHabitCompletions`, `useHabitById`,
`useToggleHabitCompletion`, `useAddHabit`, `useUpdateHabit`, `useRemoveHabit`.

`index.ts` stays an explicit named-export barrel — no `export *`.

## Fixtures

Two files, replacing the single `src/data/habits.json`:

- `src/data/habits.json` — habit definitions.
- `src/data/habit-completions.json` — the completion log.

Window: **2026-05-25 (Monday) through 2026-08-17** — exactly 12 whole weeks plus today.
Generated by a throwaway script and checked in as literal data; the script is not committed.
Fixtures are POC-only: no real user data.

Four habits, shaped so the selectors have something worth showing and each rule is exercised:

| id                  | frequency | target | intended state on 2026-08-17                              |
| ------------------- | --------- | ------ | --------------------------------------------------------- |
| `reading`           | daily     | 1      | healthy — current streak ~9 days, longest ~14             |
| `meditation`        | daily     | 1      | recently broken — gap 3 days ago, current ~2, longest ~11 |
| `workout`           | weekly    | 4      | consistent — ~6 qualifying weeks running                  |
| `language-practice` | weekly    | 3      | missed last week — current streak 0, longest ~5           |

The intended numbers above are targets for the generator, and the tests assert against
hand-written fixtures rather than against these — a fixture is demo data, not a test oracle.

**Known limitation:** these are absolute dates, like every other fixture in this repo, so they
go stale. In a few months the app will display a streak that ended long ago. Every fixture here
already has this problem, but streaks make it read as a bug rather than as old data. Recorded in
plan §6; deliberately not solved with date-shifting, which would make the fixture stop being
checked-in data.

## Consumers

**`routes/today-page.tsx`.** `todayHabitIndex = HABIT_DAY_COUNT - 1` and every `habit.days[...]`
access are removed. The five-day strip is built from `selectRecentCompletionDays(..., 5, now)`,
so its columns are real dates. Toggling calls `toggleHabitCompletionOn(habit.id, todayKey)`. The
per-habit line "3/5 recent check-ins" becomes current streak plus period progress, which is
information the old model could not produce.

**`routes/calendar-page.tsx`.** `createHabitActivityMap(habits, anchorDate)` and its anchor
arithmetic (~20 lines) are deleted and replaced by `selectHabitCompletionsByDate(completions)`
joined against habit labels. The map it produces keeps the same `Map<string, string[]>` shape,
so `createCalendarIndicators`, `createAgendaItems`, `countHabitCheckInsInMonth` and the whole
rest of that 950-line file are untouched. This is the only change to that file.

**`src/data/dashboard.ts`.** Gains `validatedHabitCompletionFixture` alongside
`validatedHabitFixture`.

> Note, out of scope: nothing in the app imports `dashboardData` or `staticData`.
> `src/data/dashboard.ts` is dead code, despite CLAUDE.md describing it as "the only cross-domain
> aggregation point". Left alone here; worth recording as debt.

## Routes

Following the `lists-page` / `list-detail-page` pair.

**`/habits` — `routes/habits-page.tsx`.** Replaces `<PlaceholderPage>` in `App.tsx`. A stats
header (habits tracked, check-ins today, best current streak), a card per habit (label,
frequency/target badge, current streak, last seven days, a toggle for today, link to detail), and
a create form.

**`/habits/:habitId` — `routes/habit-detail-page.tsx`.** New route. A twelve-week heatmap,
current and longest streak, 30-day completion rate, edit form, delete.

Per principle 10 (do not prematurely extract), UI stays inline in the route files with one
exception: `features/habits/components/habit-day-grid.tsx`, rendering a row of day cells, is used
by the Today strip, the habit cards, and the detail heatmap. Three consumers clears the reuse bar.

Design tokens only — `bg-[var(--primary)]` and friends, no hex, no Tailwind palette classes. Per
the semantic rules, a completed day is green (success), and yellow is reserved for
time-sensitive states, so a broken streak is muted rather than yellow.

## Testing

vitest is added to `apps/just-do-it` with a `test` task in `turbo.json`. Test files import
`{ describe, it, expect }` from `'vitest'` explicitly rather than enabling globals — that avoids
touching `tsconfig.app.json`'s `types` array, and keeps the test files covered by both
`pnpm typecheck` and oxlint, since they live under `src`.

`habit-selectors.test.ts` is written **before** the selectors, against a fixed `now` and
hand-written completion arrays. Cases:

- daily current streak: unbroken run; run where today is not yet complete (grace); run broken
  yesterday; single day; no completions.
- weekly current streak: consecutive qualifying weeks; current week below target with prior weeks
  qualifying (grace); a week that misses target mid-history; target exactly met vs. exceeded.
- longest streak, daily and weekly, including where longest ≠ current and where the longest run
  is the current one.
- completion rate: full window, window clamped by `createdAt`, weekly overshoot capped at 1,
  zero completions.
- `selectPeriodProgress` and `selectRecentCompletionDays` shape.
- unknown `habitId`, empty arrays.

Only the selectors are tested. The stores, routes and components are not — asserting that is
honest about what a green run covers.

## Work breakdown

Five commits on `feat/habits-domain`:

1. `chore(app): add vitest` — dependency, `vitest.config.ts`, `test` script, turbo task.
2. `feat(habits): model completions as dated records` — types, Zod schemas, both fixtures,
   the store rewrite.
3. `feat(habits): add streak, rate, and progress selectors` — tests first, then selectors.
4. `refactor(today,calendar): derive habit activity from real dates` — the two consumers.
5. `feat(habits): add habits list and detail routes` — the route pair, `App.tsx`, the day grid.

Commits 2 and 4 are a breaking pair: the app does not typecheck between them, since the
consumers still read `habit.days`. They land in sequence on one branch, and the branch is only
merged whole.

## Verification

`pnpm test`, `pnpm build` (the only real typecheck for the app until the `chore/typecheck-script`
fix is merged — after it, `pnpm typecheck` counts too), `pnpm lint`, `pnpm format:check`, then
running the app and exercising a toggle on Today, the calendar's habit chips, and both new routes.

There is still no test runner for anything but these selectors. A green build verifies types; it
does not verify the routes behave.
