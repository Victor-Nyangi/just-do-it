# Calendar selectors as a feature module — design

Date: 2026-08-27
Phase: 15 (`just-do-it-implementation-plan.md` §7) — selector coverage
Branch: `feat/calendar-selectors`

## Problem

`routes/calendar-page.tsx` is 962 lines, and **lines 97–320 are 224 lines of pure functions with
no React and no DOM** — `createTaskMap`, `createAgendaItems`, `createCalendarIndicators`,
`countHabitCheckInsInMonth` and nine others. They map tasks, habit completions and goal deadlines
onto dates, and they carry the real logic of the calendar.

None of them is tested. The plan (§6, §7) has called the calendar mapping the notable untested
logic for three phases running. The obstacle was never that it needs a browser — it does not. The
obstacle is that the functions are module-private in a route file, so nothing can call them.

This phase moves them into a feature module and tests them. **No behaviour changes.**

## Scope

**In scope:** the 224 lines of pure functions, the six type declarations they need, a test suite,
and the one `CLAUDE.md` rule this forces us to amend.

**Out of scope:**

- **jsdom and Testing Library.** Deliberately deferred to its own phase. None of this logic needs
  a DOM, and mixing a refactor with a tooling addition puts two unrelated review surfaces in one
  PR. The repo still has zero `.test.tsx` files after this lands, and `CLAUDE.md` must keep saying
  so.
- **Anything else in `packages/ui`.** The `BadgeTone` export is the only change there, and only
  because this work would otherwise duplicate the type into a new file.
- **The four sub-components** at lines 322–418 (`CalendarEmptyState`, `IndicatorChip`,
  `AgendaToggleButton`, `AgendaItemCard`). One consumer each, so extracting them would violate the
  plan's principle 10, "do not prematurely extract". `HabitDayGrid` earned its extraction at three
  consumers; these have not.
- **Shrinking the route further.** It drops from 962 to roughly 730 lines. The remainder is JSX.

## Decisions

Settled during brainstorming, recorded here so the implementation does not relitigate them:

1. **The module is `src/features/calendar/`**, following the file-name convention every other
   domain uses. The alternatives were pushing each mapping into its owning domain (cleaner, but
   touches four modules for a POC) and `src/data/calendar.ts` (follows the `dashboard.ts`
   precedent literally, but `src/data/` otherwise holds JSON fixtures, and `dashboard.ts` is dead
   code — a precedent nothing relies on).
2. **Calendar has no store and no hooks.** It owns no state: the selected month stays as
   `useState` in the route, and everything else derives from tasks, habits and goals. It is the
   first feature module without a store, and that is correct rather than an omission.
3. **`getTaskAgendaTone` moves with the rest.** It is a pure `Task → tone` mapping; splitting it
   off would strand a single function for a purity that buys nothing.
4. **`BadgeTone` is exported from `@just-do-it/ui` instead of being copied again.** It is declared
   in `packages/ui/src/components/badge.tsx` but never exported from the barrel, so
   `calendar-page.tsx` declares a second, identical union. Two definitions that can silently drift
   is already a smell; moving the copy into a new module would give it a permanent home. Add
   `export type { BadgeTone }` to the UI barrel and have `features/calendar/types.ts` import it.
   That is a two-line change to `packages/ui`, and it is in scope precisely because this work
   would otherwise entrench the duplicate.
5. **This is a behaviour-preserving move.** The moved block should differ only by
   `function` → `export function` and import rewiring. Any other change is an accidental edit.

## Module shape

```
src/features/calendar/
  calendar-selectors.ts       the 13 pure functions
  types.ts                    AgendaItem, AgendaItemKind, AgendaMode,
                              BadgeTone, DayIndicators, GoalTarget
  index.ts                    explicit named-export barrel, no `export *`
  calendar-selectors.test.ts
```

`types.ts` holds five of the six declarations currently at lines 39–64 of the route —
`AgendaItem`, `AgendaItemKind`, `AgendaMode`, `DayIndicators` and `GoalTarget`. The sixth,
`BadgeTone`, is deleted here and imported from `@just-do-it/ui` instead (decision 4).

`AgendaMode` is referenced four times by the route's JSX and moves anyway, because it is a domain
type the route imports back through the barrel. `weekdayLabels` stays in the route — it is
presentation, not logic.

### What moves

| Function                    | Owns                                              |
| --------------------------- | ------------------------------------------------- |
| `toIsoDateKey`              | date-key formatting                               |
| `pluralize`                 | label helper                                      |
| `createEmptyDayIndicators`  | zeroed indicator record                           |
| `createMonthSelection`      | keeps a selected day valid when the month changes |
| `createTaskMap`             | tasks → `Map<dateKey, Task[]>`                    |
| `createHabitActivityMap`    | habits + completions → `Map<dateKey, label[]>`    |
| `createGoalTargets`         | goals → `GoalTarget[]`                            |
| `getTaskAgendaTone`         | task → `BadgeTone`                                |
| `createAgendaItems`         | cross-domain agenda composition                   |
| `createCalendarIndicators`  | cross-domain per-day counts                       |
| `getIndicatorsForDate`      | lookup with an empty-record fallback              |
| `countHabitCheckInsInMonth` | month total                                       |
| `getDayButtonLabel`         | accessible day-button label                       |

`createHabitActivityMap` already builds on `selectHabitCompletionsByDate` from
`features/habits` — the habits domain owns the date grouping, the calendar resolves IDs to
labels. That layering is correct and is preserved.

## The rule this amends

`CLAUDE.md` currently says features must not import each other and that route files compose across
features. A `features/calendar/` importing the tasks, habits and goals barrels contradicts that as
written.

Amend the rule rather than quietly break it. The new wording must say: **cross-domain, read-only
composition may live in a feature module provided it imports only barrels, never another feature's
internals, and no other feature imports it back.** `features/calendar` is the only such module, and
the one-way direction is what keeps the dependency graph acyclic.

`src/data/dashboard.ts` remains dead code and is not revived by this work.

## Testing

The functions already work, so tests written now are **characterization tests** — the exact shape
that let a critical data-loss bug through on the previous branch. That bug survived 40 tests and a
9-of-9 mutation check, because a mutation check only proves the tests notice changes to code paths
they already exercise. It cannot reveal an input nobody thought to write.

So the mutation check is the floor here, not the ceiling. The suite must additionally cover, by
explicit enumeration:

- empty collections for tasks, habits, completions and goals;
- a date outside the displayed month;
- several items landing on the same day across all three domains at once;
- **a completion whose habit no longer exists** — `createHabitActivityMap` filters these, and
  nothing tests it;
- month boundaries, including a month whose grid spills into adjacent months;
- a task with no due date;
- a goal whose `targetDate` falls outside the displayed range;
- duplicate dates within one domain.

Expectations are hand-written literals with an injected fixed date, following
`habit-selectors.test.ts`. Never compute an expected value with the code under test.

## Verification

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all green.
- The moved block differs only by `export` and imports — check with `git diff` before committing.
- Mutation-check the new suite; every mutation caught.
- The calendar route renders identically. `pnpm dev` needs polling on this machine:
  `CHOKIDAR_USEPOLLING=1 CHOKIDAR_INTERVAL=1000 pnpm --filter @just-do-it/app exec vite`.
