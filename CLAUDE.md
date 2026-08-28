# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Just Do It** — a personal productivity POC (tasks, habits, goals, books, lists, calendar) that doubles as a proof of concept for a heterogeneous frontend monorepo. Unlike the surrounding `In Progress/` workspace (whose CLAUDE.md states nothing there is a monorepo), **this directory is a real pnpm + Turborepo monorepo** with its own git repo. Run commands from this root, not from the parent.

`just-do-it-implementation-plan.md` is the authoritative roadmap — phases, the intended data model, and 12 architectural principles. Read the relevant phase before adding a domain. Sections that describe the _future_ (Supabase, TanStack Query, shadcn/ui CLI, `packages/config`, `packages/utils`) are **not yet implemented and intentionally deferred**; don't wire them in because the plan mentions them.

## Commands

Everything runs through Turbo from the repo root (pnpm 10, `packageManager` pinned):

```sh
pnpm install
pnpm dev          # turbo dev -> vite dev server for apps/just-do-it
pnpm build        # tsc -b && vite build
pnpm lint         # oxlint (app only — see below)
pnpm typecheck    # tsc -b --noEmit --force (app), tsc --noEmit (ui)
pnpm test         # vitest run (app only — see below for what's covered)
pnpm format       # prettier --write .
pnpm format:check
```

Per-package: `pnpm --filter @just-do-it/app dev`, `pnpm --filter @just-do-it/app preview`.

Things to know before trusting a green run:

- **`pnpm typecheck` really checks the app now — it did not until `chore/typecheck-script`.** The app's script used to be `tsc --noEmit`, which resolves the solution-style `apps/just-do-it/tsconfig.json` (`"files": []` plus `references`); `--noEmit` does not follow references, so it checked zero files and passed unconditionally. It is now `tsc -b --noEmit --force`, which follows the references and re-checks every run rather than trusting a stale `.tsbuildinfo`. If you touch that script, verify the change by planting a deliberate type error and confirming a non-zero exit — a green run alone proves nothing.
- **`pnpm test` runs vitest, and coverage is selector- and store-deep but UI-blind.** All five domains now have tests: habit selectors, schemas and store; task selectors; goal selectors and store; book store; list selectors and store — plus `features/calendar`'s date-mapping selectors. **No route or component has a test** — there are still zero `.test.tsx` files, jsdom is not configured — so nothing renders under test. `calendar-page.tsx`'s date-mapping logic is now covered via `features/calendar`, but the route itself is not. A passing `build` is not verification of behavior beyond types, and a passing `test` says nothing about the UI.
- **`packages/ui` has no real lint or build.** Its `build`, `lint`, and `typecheck` scripts are all `tsc --noEmit`; `@just-do-it/ui#build` declares no outputs because the app consumes `src/index.ts` directly (no compile step, no `dist`). Oxlint only ever runs over `apps/just-do-it`.
- **Formatting is uniform and must stay that way.** The whole tree was normalized to Prettier's configured style in `09bd4c9` — semicolons, single quotes, trailing commas, 100 columns. `pnpm format:check` passes; keep it passing. CI runs it on every push to `main` and every pull request, so a drifted tree now fails the build — but there is still no pre-commit hook, so run `pnpm format` before committing rather than finding out from a red check. `.prettierignore` excludes `pnpm-lock.yaml`; `dist` and `node_modules` are covered by `.gitignore`, which Prettier honours by default.

## Architecture

### Data flow — fixtures, not a server

The POC has no backend. Every domain follows the same one-way pipeline, and this boundary is the point of the design (a hosted API later replaces only the first two steps):

```
src/data/<domain>.json      raw fixture, checked in
   ↓  <domain>-data.ts      Zod schema + parse at module load  → validatedXFixture / getInitialX()
   ↓  <domain>-store.ts     Zustand store, seeded from getInitialX()
   ↓  hooks.ts              thin useX() wrappers over the store
   ↓  routes/*.tsx          presentation
```

Zod is not just an import-time guard: stores re-`parse()` through `buildXRecord()` on **every mutation**, so invalid state can't be written by feature code either. Preserve that when adding actions. Fixtures are parsed eagerly at import — a malformed JSON fixture throws at app boot, not at render.

The single `<domain>.json` shown above is the common case, not a rule: `features/habits` has two top-level fixtures (`habits.json` and `habit-completions.json`), deliberately mirroring the two planned backend tables. A domain with more than one entity should parse and export more than one fixture from its `-data.ts`, the way habits does.

All edits are session-local by design; nothing persists across a reload (except the theme). Don't add localStorage persistence or a fetch layer without being asked.

Cross-domain composition has two homes. `src/data/dashboard.ts` aggregates fixtures (and is
currently dead code — nothing imports it). `features/calendar` composes tasks, habits and goals
onto dates, and is the one feature module allowed to import other features. The rule it must obey:
**barrels only, never another feature's internals, and strictly one-way** — no feature imports
`calendar` back, which is what keeps the dependency graph acyclic. Every other feature stays
independent, and route files compose across them.

`features/tasks/quick-add-parser.ts` is a pure text→data function (`parseQuickAdd(input, now)`),
sitting beside the selectors rather than in the fixture pipeline. It takes an injectable `now`
for the same reason selectors do, and applies no defaults — absent fields mean "not specified",
and `QuickAddField` — the feature component that calls it, not the route — supplies
`todo`/`medium`/`Personal`.

### Feature modules

`src/features/<domain>/` with a fixed file-name convention (`<domain>-data.ts`, `<domain>-store.ts`, `<domain>-selectors.ts`, `hooks.ts`, `types.ts`, `index.ts`). Follow it for new domains.

- `types.ts` holds `const X_VALUES = [...] as const` arrays plus types derived from them; the Zod schema in `-data.ts` builds its enums from those same arrays, so the union and the validator can't drift.
- `index.ts` is an explicit named-export barrel — no `export *`. Anything a route needs must be added there; routes import from `'../features/<domain>'`, never a deeper path.
- Selectors are **pure functions over `readonly T[]`**, not hooks, and take injectable `now = new Date()` for date logic. Hooks compose them inside the store subscription (`useTaskStore((state) => selectActiveTaskCount(state.tasks))`).
- `features/tasks` and `features/habits` are the only domains with a `components/` subdirectory — habits earned it because `HabitDayGrid` has three genuine consumers (the Today strip, the habits-list cards, and the detail-page heatmap). Other domains keep their UI inline in the route file, which is why `routes/calendar-page.tsx` (708 lines) and `books-page.tsx` (~600) are large. Extract into `features/<domain>/components/` only when a piece is genuinely reused like that — the plan's principle 10 is "do not prematurely extract".
- `features/calendar` is the only domain with **no store and no hooks**. It owns no state — the
  selected month is `useState` in the route — and every export is a pure function over data from
  the other three domains. Its absence of a store is deliberate, not an oversight.
- The plan's sketch of `src/{components,lib,stores,types}/` was deliberately not built; stores and types live inside their feature.

Routing is flat in `App.tsx` under a single `AppLayout` outlet, with nested dynamic routes for habit and list detail (`/habits/:habitId`, `/lists/:listId`). `/settings` is still `<PlaceholderPage>`; `/habits` is not. Unknown paths redirect to `/today`.

### Design system

`packages/ui` (`@just-do-it/ui`) exports four primitives — `Button`, `Card`, `Badge`, `Input` — plus `cn` (clsx + tailwind-merge). Consumed as raw TypeScript source via the `exports` map.

Theming is **CSS custom properties, not Tailwind theme colors**. `packages/ui/src/styles.css` defines the full semantic palette on `:root` and overrides it under `:root[data-theme='dark']`; components reference them as arbitrary values (`bg-[var(--primary)]`, `text-[var(--muted-foreground)]`). Add a new color by adding a token to _both_ blocks — never hard-code a hex or a Tailwind palette class in a component.

Semantics carry meaning and shouldn't be swapped for aesthetics: green = primary/success, purple = accent action, yellow = warning/time-sensitive only.

Tailwind v4 is configured entirely in CSS (`@tailwindcss/vite`, no `tailwind.config`). The app's `src/styles.css` imports the UI stylesheet and declares `@source "../../../packages/ui/src"` so Tailwind scans the package — if a class only used inside `packages/ui` goes missing at runtime, that directive is why.

Dark mode is a `useState` in `AppLayout` writing `document.documentElement.dataset.theme` and `localStorage['theme']`. There is no context provider; anything else needing the theme should read the same key.

## Conventions

- Variable names are spelled out (`leftTask`/`rightTask` in comparators, `existingList`, `normalizedValue`) — no single-letter or abbreviated identifiers. Match that.
- Icons come from `lucide-react`, dates from `date-fns` (`parseISO`, `isToday`, `startOfDay` — no hand-rolled date math), IDs from `crypto.randomUUID()`.
- Commits are Conventional Commits scoped by domain (`feat(books):`, `refactor(features):`), one branch per plan phase (`feat/static-lists`, `feat/today-dashboard`), rebased onto `main` rather than merged — the history is linear and the old phase branches are left behind as duplicates. Check `git branch --show-current`; `main` is the integration branch.
- Fixtures are POC-only: no real user data or secrets in `src/data/*.json`.
