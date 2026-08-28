# Just Do It: Implementation Plan

**Repository:** <https://github.com/Victor-Nyangi/just-do-it>
**Status as of 2026-08-27:** Phases 1–11 and 13 complete, Phase 12 partial. See [§3 Phase status](#3-phase-status).

---

## 1. Overview

**Just Do It** is a personal productivity POC for managing tasks, daily schedules, habits, books, hobbies, goals, bucket lists, and unscheduled idea lists.

It is also a proof of concept for a heterogeneous frontend monorepo — React + Vite today, with room for Next.js and Astro applications sharing design-system packages later.

### Delivery decision (still in force)

The POC runs on versioned static JSON fixtures. There is no backend. Changes made in the browser are intentionally session-local and vanish on reload. Hosted persistence, authentication, and sync are deferred to Phase 15 and start only once a managed backend exists.

### About this revision

The original plan carried **two conflicting phase numberings** — a "Phase 1–12" sequence in the body and a different "Phase 1–9" sequence in the roadmap appendix. That is why the current position was ambiguous. This revision uses **one numbering, 1–16**, aligned to the original body sequence and extended past it. Under the old roadmap appendix numbering the project sat at its Phase 7; under the body numbering it sits at Phase 12. Same place, two labels.

---

## 2. Architecture as built

| Concern         | Choice                                                    | Status                                                                                                              |
| --------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Monorepo        | Turborepo + pnpm workspaces                               | Built                                                                                                               |
| Application     | React 19 + Vite 8 + TypeScript                            | Built                                                                                                               |
| Routing         | React Router 7                                            | Built                                                                                                               |
| Styling         | Tailwind CSS 4 (CSS-first config, no `tailwind.config`)   | Built                                                                                                               |
| Components      | **Hand-rolled `packages/ui`** — shadcn/ui was not adopted | Built, deviates from original plan                                                                                  |
| Local state     | Zustand, one store per feature                            | Built                                                                                                               |
| Validation      | Zod, at import **and** on every mutation                  | Built                                                                                                               |
| Dates           | date-fns                                                  | Built                                                                                                               |
| Icons           | Lucide                                                    | Built                                                                                                               |
| Linting         | **oxlint** (app only) — ESLint was not adopted            | Built, deviates                                                                                                     |
| Formatting      | Prettier at the root                                      | Configured, drifted (§6)                                                                                            |
| Server state    | TanStack Query                                            | Deferred to Phase 15                                                                                                |
| Database / auth | Supabase or equivalent                                    | Deferred to Phase 15                                                                                                |
| Deployment      | Vercel                                                    | Not started (Phase 14)                                                                                              |
| Tests           | vitest                                                    | 191 tests across all five domains — selectors, stores, schemas and the quick-add parser. No route or component test |

### Data flow

Every domain follows the same one-way pipeline. This boundary is the whole point of the fixture phase: a hosted API later replaces only the top two steps.

```text
src/data/<domain>.json        raw fixture, checked in
   ↓  <domain>-data.ts        Zod schema + parse at module load
   ↓  <domain>-store.ts       Zustand store, seeded from getInitialX()
   ↓  hooks.ts                thin useX() wrappers over the store
   ↓  routes/*.tsx            presentation
```

A single `<domain>.json` is the common case, not a rule: habits is the first domain with two top-level fixtures (`habits.json` and `habit-completions.json`), deliberately mirroring the two planned backend tables. A `-data.ts` module may parse and re-export more than one fixture when the domain has more than one entity.

### Actual tree

```text
indie-mono-repo/
├── apps/
│   └── just-do-it/
│       └── src/
│           ├── data/          tasks|habits|habit-completions|goals|books|lists.json + dashboard.ts
│           ├── features/      books, goals, habits, lists, tasks
│           ├── layouts/       app-layout.tsx
│           ├── routes/        today, tasks, calendar, goals, books, lists, list-detail,
│                           habits, habit-detail, placeholder
│           ├── App.tsx
│           └── main.tsx
├── packages/
│   └── ui/                    Button, Card, Badge, Input, cn + semantic tokens
├── .github/workflows/         ci.yml
├── turbo.json
├── pnpm-workspace.yaml
└── CLAUDE.md
```

The planned `src/{components,lib,stores,types}/` directories were deliberately **not** created — stores and types live inside their feature. The planned `packages/{config,utils,types}` were **not** created either; nothing has needed them yet (principle 10).

### Feature module convention

`src/features/<domain>/` with fixed file names: `<domain>-data.ts`, `<domain>-store.ts`, `<domain>-selectors.ts`, `hooks.ts`, `types.ts`, `index.ts`.

- `types.ts` declares `const X_VALUES = [...] as const`; both the TypeScript union and the Zod enum derive from it, so they cannot drift.
- `index.ts` is an explicit named-export barrel. Routes import from `'../features/<domain>'`, never a deeper path.
- Selectors are pure functions over `readonly T[]` with injectable `now = new Date()`. Hooks compose them inside the store subscription.
- `features/tasks` and `features/habits` are the only domains with a `components/` subdirectory — habits earned it via three real consumers of `HabitDayGrid` (the Today strip, the habits-list cards, and the detail-page heatmap). Other domains keep UI in the route file until reuse is real.

---

## 3. Phase status

| #   | Phase                          | Status                    | Notes                                                                                                                                                                                                      |
| --- | ------------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Monorepo foundation            | **Done**                  | No shared config packages; oxlint replaced ESLint                                                                                                                                                          |
| 2   | Application foundation         | **Done**                  | shadcn/ui and TanStack Query intentionally skipped                                                                                                                                                         |
| 3   | Shared design system           | **Done**                  | 4 primitives, not the 10 originally listed                                                                                                                                                                 |
| 4   | Static data foundation         | **Done**                  | 5 fixtures, Zod-validated                                                                                                                                                                                  |
| 5   | Initial data model             | **Done, with deviations** | Habits diverge materially — §5                                                                                                                                                                             |
| 6   | Feature architecture           | **Done**                  | Canonical; all 5 domains follow it                                                                                                                                                                         |
| 7   | Today dashboard                | **Done**                  | Sections, habit strip, goal progress, quick add                                                                                                                                                            |
| 8   | Calendar                       | **Done**                  | Month grid, day select, day/week agenda, all indicators                                                                                                                                                    |
| 9   | Goals                          | **Done**                  | Create, edit, progress, status                                                                                                                                                                             |
| 10  | Books                          | **Done**                  | 3 statuses, ratings, notes                                                                                                                                                                                 |
| 11  | Lists                          | **Done — uncommitted**    | Working tree only; per-item notes missing                                                                                                                                                                  |
| 12  | Quick add & command surface    | **Partial**               | Natural-language parser and preview ship on Today and Tasks; no command palette                                                                                                                            |
| 13  | Habits as a first-class domain | **Done**                  | Dated completions, streak/rate selectors, `/habits` and `/habits/:habitId` routes                                                                                                                          |
| 14  | Product polish & deploy        | **Not started**           | No Vercel config, no PWA, no `/settings`                                                                                                                                                                   |
| 15  | Testing & quality gates        | **Partial**               | CI gate runs all five checks; 252 vitest tests cover every domain's selectors and stores, the quick-add parser, and the calendar mapping — no route or component test, and `packages/ui` is still unlinted |
| 16  | Hosted persistence             | **Deferred**              | Blocked on a managed backend                                                                                                                                                                               |

**Where the project actually is:** the entire fixture-backed product surface is built, habits included. What remains is not more domains — it is _finishing_ the one half-built one (quick add), then hardening (deploy, polish).

---

## 4. Phases 1–11 — what shipped

### Phase 1 — Monorepo foundation ✅

pnpm workspace (`apps/*`, `packages/*`), Turborepo with `build`/`dev`/`lint`/`typecheck` tasks, root Prettier, root scripts. All four turbo tasks verified.

Deviations, all deliberate:

- **No `packages/config`.** Each app owns its `tsconfig` and lint config. Revisit when a second app exists.
- **oxlint, not ESLint.** Faster, zero-config for this shape. It runs on the app only.
- `packages/ui` has no build step — the app imports `src/index.ts` directly through the `exports` map, so `@just-do-it/ui#build` declares no outputs.

### Phase 2 — Application foundation ✅

App shell, sidebar navigation with 7 destinations, sticky header, responsive layout with a mobile drawer, dark mode, and the full route table.

- **shadcn/ui was not used.** Its CLI assumes a single app with a `components.json` and copies files in; for a shared workspace package, hand-written primitives over semantic tokens turned out simpler. No `components.json` exists.
- **TanStack Query was not installed.** Correct per principle 8 — there is no server state to manage.
- Dark mode is `useState` in `AppLayout` writing `document.documentElement.dataset.theme` plus `localStorage['theme']`. No context provider.

### Phase 3 — Shared design system ✅

`@just-do-it/ui` exports `Button` (5 variants), `Card` (4), `Badge` (4), `Input`, and `cn`.

Theming is **CSS custom properties, not Tailwind theme colors**: `packages/ui/src/styles.css` defines the palette on `:root` and overrides it under `:root[data-theme='dark']`. Components reference tokens as arbitrary values (`bg-[var(--primary)]`). Adding a colour means adding a token to _both_ blocks — never a raw hex, never a Tailwind palette class.

Palette: light "Botanical Noir" (linen, charcoal, moss, lilac), dark "Midnight Orchid" (void black, graphite, emerald, orchid). Sora for headings, Manrope for body. Semantics are load-bearing: green = primary/success, purple = accent action, yellow = warning only.

The app declares `@source "../../../packages/ui/src"` so Tailwind scans the package for classes.

Only 4 of the 10 planned primitives exist. `dialog`, `dropdown-menu`, `popover`, `tabs`, `tooltip`, and `command` were not built — nothing has needed them. Phase 12 will need `command`, and Phase 13 will likely need `dialog`.

### Phase 4 — Static data foundation ✅

Fixtures for all five domains under `src/data/`, each parsed by a Zod schema at module load. `src/data/dashboard.ts` is the only cross-domain aggregation point, and it imports from feature barrels — never the reverse.

Two things the original plan asked for and did not get:

- **Loading and error-state patterns.** Not applicable while everything is synchronous; genuinely needed at Phase 16. Empty states _do_ exist across pages.
- No data-source _interface_ abstraction was introduced. Stores call `getInitialX()` directly. Swapping to a server means rewriting `-data.ts` and the store seed — an acceptable, contained blast radius.

### Phase 5 — Initial data model ✅ (with deviations)

Built, but the shipped schemas differ from the plan's sketch. Full comparison in [§5](#5-data-model-as-built).

### Phase 6 — Feature architecture ✅

All five domains follow the convention above. The plan's `queries/` and `mutations/` subdirectories were replaced by a single `-store.ts` plus `hooks.ts` — correct while there is no server. They come back at Phase 16.

### Phase 7 — Today dashboard ✅

Greeting and date, task sections (**Overdue / Due today / Flexible**), a 5-day habit strip with inline toggling, goal progress, and quick add. Section grouping and sorting live in `selectTodayTaskSections` with injectable `now`.

### Phase 8 — Calendar ✅

Every original checkbox is ticked: monthly grid (Monday-first), day selection, tasks for the selected day, goal milestones, habit activity, and a **day / week agenda toggle**. Per-day indicator chips count tasks, habit check-ins, and goal targets. Day buttons carry composed `aria-label`s. All date maths goes through date-fns.

At ~950 lines, `calendar-page.tsx` is the largest file in the repo and the first candidate for extraction into `features/calendar/`.

### Phase 9 — Goals ✅

Goal cards with progress bars, status (`active` / `paused` / `completed`), target dates, create and edit. Progress is a manually set number — aggregation from tasks and habits remains future work.

### Phase 10 — Books ✅

Shelves for `want_to_read` / `reading` / `finished`, plus ratings and notes. Not built: `abandoned` status, `started_at` / `finished_at`, reading progress, covers, author metadata, reading goals.

### Phase 11 — Lists ✅ — **but uncommitted**

Create list, rename, list-level note, add item, toggle item, reorder item (up/down buttons, not drag), delete item, delete list. Routes `/lists` and `/lists/:listId`.

⚠️ **This work exists only in the working tree.** `feat/static-lists` is still at the Books commit; `App.tsx`, three `features/lists/*` files are modified and both route files are untracked. **Commit before anything else.**

Gap: the plan specified **per-item** notes (`list_items.notes`). What shipped is a single note per _list_.

---

## 5. Data model as built

Shared conventions: camelCase fields, string IDs (`crypto.randomUUID()` for new records), ISO-8601 strings for dates. Stores re-`parse()` through the Zod schema on every mutation, so invalid state cannot be written by feature code.

### Tasks — matches the plan, extended

```text
id · title · description? · status · priority · category
dueDate? (ISO date) · completedAt? (ISO datetime)
recurrence · recurrenceInterval · createdAt · updatedAt
```

`status`: `todo` | `in_progress` | `completed` — the plan implied only done/not-done.
`priority`: `low` | `medium` | `high` | `urgent`
`category`: `Personal` | `Workout` | `Reading` | `Hobby` | `Errand` | `Other` — title-case, not the plan's SCREAMING_CASE.
`recurrence`: `none` | `daily` | `weekly` | `monthly`, with an interval — **not in the original plan**, added during Phase 5.

### Goals — matches, one gap

```text
id · title · description · period · targetDate · progress · status
```

`status`: `active` | `paused` | `completed`.
⚠️ `period` is a **free-form string**, not the planned `WEEK` | `MONTH` | `YEAR` enum. Tighten it to a `GOAL_PERIOD_VALUES` const array to match the rest of the codebase's pattern.
No `createdAt` / `updatedAt`.

### Habits — now matches the plan

```text
habits:      id · label · description? · frequency · target · createdAt
completions: id · habitId · date   // 'yyyy-MM-dd' key, not a timestamp
```

`frequency`: `daily` | `weekly`. For daily habits `target` is always `1`; for weekly habits it is the number of qualifying completions per calendar week (Monday-first).

This replaces the fixed 5-slot `days: boolean[]` array from earlier phases with the two-table shape the original plan called for: a `habits` record plus a separate, dated `habit_completions` collection. Nine selectors in `features/habits/habit-selectors.ts` (`toHabitDateKey`, `isHabitCompletedOn`, `selectHabitCompletionsByDate`, `selectCompletionDatesForHabit`, `selectCurrentStreak`, `selectLongestStreak`, `selectCompletionRate`, `selectPeriodProgress`, `selectRecentCompletionDays`) derive streaks, completion rate, and period progress from real dates instead of array position. `/habits` and `/habits/:habitId` render the list and per-habit history; Today's habit strip and the calendar's habit activity both consume the same dated completions.

### Books — matches, trimmed

```text
id · title · author · status · rating? · note?
```

`status`: `want_to_read` | `reading` | `finished`. Missing versus plan: `abandoned`, `started_at`, `finished_at`.

### Lists — matches, trimmed

```text
lists:      id · name · note? · items[]
list_items: id · title · complete
```

Missing versus plan: `lists.icon`, `list_items.notes`, `list_items.position` (order is array position — fine in memory, needs a real column once persisted), and `lists.description` (collapsed into `note`).

---

## 6. Known debt

Carry these into whichever phase touches them; none block progress today.

- ~~**Uncommitted Phase 11 work.**~~ Resolved in `b2287b9` — the Lists workspace is committed, and the four `TS18047` errors it was carrying are fixed.
- ~~**Prettier has drifted.**~~ Resolved in `09bd4c9` — the tree was normalized to the configured style in one isolated commit. Enforced since the Phase 15 CI gate — `format:check` runs on every push to `main` and every pull request.
- **`packages/ui` is not linted.** Its `build`, `lint`, and `typecheck` scripts are all `tsc --noEmit`. oxlint never sees it.
- ~~**`pnpm typecheck` silently checks nothing in the app.**~~ Resolved — the script is now `tsc -b --noEmit --force`, which follows the solution file's `references` instead of checking zero files, and re-checks every run rather than trusting a cached `.tsbuildinfo`. The app was clean when it first ran for real; no latent errors surfaced.
- **Test coverage is deep on logic and blind on UI.** 252 vitest tests cover every domain's
  selectors and stores, the Zod round-trip on mutation, the quick-add parser, and — since the
  extraction into `features/calendar` — the calendar date mapping. **No route or component has a
  test** — there are no `.test.tsx` files at all, because jsdom and Testing Library are not
  configured. The remaining gap is route and component rendering only. A green `build` /
  `typecheck` verifies nothing about behaviour beyond types.
- **`calendar-page.tsx` 708 lines (down from ~950 after extracting the date-mapping selectors into `features/calendar`), `books-page.tsx` ~600, `goals-page.tsx` ~555.** Domain UI living in route files. Extract per domain when touched.
- **`/settings` renders `PlaceholderPage`.** It is a live nav destination that leads nowhere. (`/habits` is no longer in this state — Phase 13.)
- **Phase branches are duplicated.** Each `feat/*` branch has a cherry-picked twin from the pre-rebase history. Prune the stale ones.
- **Habit fixtures go stale.** `src/data/habit-completions.json` uses absolute dates like every other fixture in this repo, so it goes stale — in a few months the app will display a streak that ended long ago. Every fixture here already has this problem, but streaks make it read as a bug rather than as old data. Deliberately not solved with date-shifting, which would make the fixture stop being checked-in data.
- **`src/data/dashboard.ts` is dead code.** Nothing in the app imports `dashboardData` or `staticData`, despite CLAUDE.md describing this file as "the only cross-domain aggregation point."

---

## 7. Remaining roadmap

### Phase 12 — Quick add & command surface (partial)

What exists: a quick-add input on Today and Tasks that parses the typed title into a due date,
category, and priority (`parseQuickAdd`), with a live parsed-result preview shown before commit.
Fields the parser can't find still fall back to the prior hard-coded defaults (`todo`, `medium`,
`Personal`).

- [x] Natural-language parser — `Workout tomorrow`, `Read 20 pages Friday`, `Finish portfolio Aug 20`
- [x] Parse due date via date-fns; category and priority via explicit sigils (`#Reading`, `!high`)
- [x] Show a parsed-result preview before commit, so the guess is correctable
- [ ] Command palette (⌘K) — needs a `command` primitive in `packages/ui`
- [ ] Keyboard shortcuts for new task, search, and navigation
- [ ] Make quick add reachable from every route, not just Today

The parser shipped with explicit sigils for category and priority (`#Reading`, `!high`) rather
than keyword inference — "Buy a book about workout nutrition" matches two categories and any
tie-break is a guess. Dates are natural language (`today`, `tomorrow`, `Friday`, `next Friday`,
`Aug 20`, `20 August`, `2026-11-30`); matched tokens are stripped from the title, and a bare
month-day already in the past rolls forward one year. Quick add is on Today and Tasks; the
remaining three boxes are the command-palette half of this phase, deferred to its own spec.
Recurrence parsing (`every Monday`) and description parsing were also considered and deferred.
40 parser tests were added; the repo total is now 172. See
`docs/superpowers/specs/2026-08-27-quick-add-parser-design.md`.

Build the parser as a pure, unit-testable function in `features/tasks/`. No AI — revisit only if a plain parser proves inadequate.

### Phase 13 — Habits as a first-class domain

The single largest gap between the plan and the build.

- [x] Replace `days: boolean[]` with dated completions: `{ id, habitId, completedAt }`
- [x] Add `frequency` and `target` to the habit record; add `description`
- [x] Selectors for current streak, longest streak, completion rate, and progress against target
- [x] Build `/habits` — habit list, per-habit detail, history view
- [x] Rewrite the Today strip and calendar habit activity against real dates
- [x] Widen the fixture to cover enough history to make streaks meaningful

Do this before Phase 16 — migrating a positional array into a completions table after the backend lands is strictly harder.

### Phase 14 — Product polish & deploy

- [ ] Build `/settings` — theme preference, week start day, default task category
- [ ] Extract oversized route files into `features/<domain>/components/`
- [ ] Mobile layout pass across every route
- [ ] Empty and error states audited for consistency
- [ ] Vercel project, root directory `apps/just-do-it`, Turbo-aware build
- [ ] SPA rewrite rule so deep links like `/lists/:listId` resolve
- [ ] PWA consideration — offline is a real fit for a fixture-backed app
- [x] Resolve the Prettier drift in one dedicated commit — done in `09bd4c9`

### Phase 15 — Testing & quality gates

Not in the original plan. Added because the repo had no way to verify anything; most of it has since landed.

- [x] Vitest in `apps/just-do-it`, wired as a `test` task in `turbo.json`
- [x] Unit tests for selectors — `selectTodayTaskSections`, habit streaks, the quick-add parser
      and the calendar mapping
- [x] Store tests for the mutation → Zod round-trip — all four stores
- [ ] Fixture-validity tests, so a malformed fixture fails CI rather than app boot — enforced
      indirectly today (each `-data.ts` parses its fixture eagerly at import, so a malformed one
      throws the moment any test imports it) but never asserted directly
- [ ] React Testing Library for Today and Tasks
- [x] GitHub Actions running `format:check`, `lint`, `typecheck`, `test`, `build`
- [ ] Extend oxlint to `packages/ui` — its `lint` script is still `tsc --noEmit`

### Phase 16 — Hosted persistence (deferred)

Start only once a managed backend exists.

- [ ] Create the Supabase project (or equivalent); apply schema and Row Level Security
- [ ] Configure auth and environment variables; add `/login` and `/signup`
- [ ] Generate database types from the linked project
- [ ] Replace each `-data.ts` with typed query/mutation modules — the store and hook layers should barely move
- [ ] Introduce TanStack Query for server state and optimistic updates
- [ ] Add the loading and error-state patterns deferred from Phase 4
- [ ] Migrate any POC data worth keeping

The feature architecture was built for exactly this swap. If Phase 16 forces changes to `routes/` or `hooks.ts`, the boundary leaked and that is the thing to fix.

---

## 8. Architectural principles

Unchanged from the original plan, with what each has actually meant in practice.

1. **Keep the monorepo framework-agnostic.** Root holds turbo, pnpm, and Prettier — nothing React-specific.
2. **Each application should be independently deployable.**
3. **Do not group Next.js applications artificially.**
4. **Share design tokens across frameworks.** Tokens are plain CSS custom properties precisely so a future Astro or Next app can consume them without React.
5. **Share React components only where they genuinely make sense.** 4 primitives shared, all domain UI local.
6. **Keep domain logic feature-oriented.** Held across all five domains.
7. **Use JSON fixtures and local state until a hosted backend is available.**
8. **TanStack Query only for server state.** Honoured — it is not installed.
9. **Do not introduce Next.js solely for SSR.**
10. **Do not prematurely extract shared packages.** Why `packages/config`, `utils`, and `types` still do not exist.
11. **Keep backend-specific logic local to Just Do It until another app needs it.**
12. **Optimize for a small, delightful POC before adding complexity.**

---

## 9. Target outcome

The milestone is not a productivity platform. It is a polished POC proving that:

- Turborepo can comfortably host heterogeneous frontend applications
- React + Vite works well beside future Next.js and Astro apps
- A small token-driven design system provides a shared language without shadcn's copy-in model
- Static JSON plus Zod unlocks a complete product surface with no backend
- The architecture can grow without becoming an enterprise-sized spaceship

The core experience stays simple:

> **Open Just Do It → see what matters → do it → check it off.**

Phases 1–11 have delivered that surface. Phases 12–15 make it trustworthy; Phase 16 makes it real.
