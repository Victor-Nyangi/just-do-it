# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Just Do It** — a personal productivity POC (tasks, habits, goals, books, lists, calendar) that doubles as a proof of concept for a heterogeneous frontend monorepo. Unlike the surrounding `In Progress/` workspace (whose CLAUDE.md states nothing there is a monorepo), **this directory is a real pnpm + Turborepo monorepo** with its own git repo. Run commands from this root, not from the parent.

`just-do-it-implementation-plan.md` is the authoritative roadmap — phases, the intended data model, and 12 architectural principles. Read the relevant phase before adding a domain. Sections that describe the *future* (Supabase, TanStack Query, shadcn/ui CLI, `packages/config`, `packages/utils`) are **not yet implemented and intentionally deferred**; don't wire them in because the plan mentions them.

## Commands

Everything runs through Turbo from the repo root (pnpm 10, `packageManager` pinned):

```sh
pnpm install
pnpm dev          # turbo dev -> vite dev server for apps/just-do-it
pnpm build        # tsc -b && vite build
pnpm lint         # oxlint (app only — see below)
pnpm typecheck    # tsc --noEmit — but see below, this does NOT check the app
pnpm format       # prettier --write .
pnpm format:check
```

Per-package: `pnpm --filter @just-do-it/app dev`, `pnpm --filter @just-do-it/app preview`.

Things to know before trusting a green run:

- **`pnpm typecheck` does not typecheck the app.** The app's script is `tsc --noEmit`, which resolves `apps/just-do-it/tsconfig.json` — a solution-style file with `"files": []` and only `references`. `--noEmit` ignores references, so it checks zero files and always passes. Real type errors surface only from `pnpm build` (`tsc -b`, which does follow references). **Always run `pnpm build` to verify types**; treat a green `typecheck` as meaningless for the app.
- **There is no test runner anywhere in this repo.** No vitest, no jest, no `pnpm test`. A passing `build` is not verification of behavior — say so rather than claiming a change is tested.
- **`packages/ui` has no real lint or build.** Its `build`, `lint`, and `typecheck` scripts are all `tsc --noEmit`; `@just-do-it/ui#build` declares no outputs because the app consumes `src/index.ts` directly (no compile step, no `dist`). Oxlint only ever runs over `apps/just-do-it`.
- **Prettier has drifted.** `pnpm format:check` currently fails on ~48 files — the repo mixes semicolon and no-semicolon style (newer route files use semicolons, older feature modules don't). Running `pnpm format` will rewrite most of the tree. Match the surrounding file's style instead of reformatting on the side; only run `format` if the user asks for it.

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

All edits are session-local by design; nothing persists across a reload (except the theme). Don't add localStorage persistence or a fetch layer without being asked.

`src/data/dashboard.ts` is the only cross-domain aggregation point, and it imports *from the feature barrels* — never the reverse. Features must not import each other's internals; route files compose across features.

### Feature modules

`src/features/<domain>/` with a fixed file-name convention (`<domain>-data.ts`, `<domain>-store.ts`, `<domain>-selectors.ts`, `hooks.ts`, `types.ts`, `index.ts`). Follow it for new domains.

- `types.ts` holds `const X_VALUES = [...] as const` arrays plus types derived from them; the Zod schema in `-data.ts` builds its enums from those same arrays, so the union and the validator can't drift.
- `index.ts` is an explicit named-export barrel — no `export *`. Anything a route needs must be added there; routes import from `'../features/<domain>'`, never a deeper path.
- Selectors are **pure functions over `readonly T[]`**, not hooks, and take injectable `now = new Date()` for date logic. Hooks compose them inside the store subscription (`useTaskStore((state) => selectActiveTaskCount(state.tasks))`).
- Only `features/tasks` has a `components/` subdirectory. Other domains keep their UI inline in the route file, which is why `routes/calendar-page.tsx` (~950 lines) and `books-page.tsx` (~600) are large. Extract into `features/<domain>/components/` when a piece is genuinely reused — the plan's principle 10 is "do not prematurely extract".
- The plan's sketch of `src/{components,lib,stores,types}/` was deliberately not built; stores and types live inside their feature.

Routing is flat in `App.tsx` under a single `AppLayout` outlet. `/habits` and `/settings` are still `<PlaceholderPage>`. Unknown paths redirect to `/today`.

### Design system

`packages/ui` (`@just-do-it/ui`) exports four primitives — `Button`, `Card`, `Badge`, `Input` — plus `cn` (clsx + tailwind-merge). Consumed as raw TypeScript source via the `exports` map.

Theming is **CSS custom properties, not Tailwind theme colors**. `packages/ui/src/styles.css` defines the full semantic palette on `:root` and overrides it under `:root[data-theme='dark']`; components reference them as arbitrary values (`bg-[var(--primary)]`, `text-[var(--muted-foreground)]`). Add a new color by adding a token to *both* blocks — never hard-code a hex or a Tailwind palette class in a component.

Semantics carry meaning and shouldn't be swapped for aesthetics: green = primary/success, purple = accent action, yellow = warning/time-sensitive only.

Tailwind v4 is configured entirely in CSS (`@tailwindcss/vite`, no `tailwind.config`). The app's `src/styles.css` imports the UI stylesheet and declares `@source "../../../packages/ui/src"` so Tailwind scans the package — if a class only used inside `packages/ui` goes missing at runtime, that directive is why.

Dark mode is a `useState` in `AppLayout` writing `document.documentElement.dataset.theme` and `localStorage['theme']`. There is no context provider; anything else needing the theme should read the same key.

## Conventions

- Variable names are spelled out (`leftTask`/`rightTask` in comparators, `existingList`, `normalizedValue`) — no single-letter or abbreviated identifiers. Match that.
- Icons come from `lucide-react`, dates from `date-fns` (`parseISO`, `isToday`, `startOfDay` — no hand-rolled date math), IDs from `crypto.randomUUID()`.
- Commits are Conventional Commits scoped by domain (`feat(books):`, `refactor(features):`), one branch per plan phase (`feat/static-lists`, `feat/today-dashboard`), rebased onto `main` rather than merged — the history is linear and the old phase branches are left behind as duplicates. Check `git branch --show-current`; `main` is the integration branch.
- Fixtures are POC-only: no real user data or secrets in `src/data/*.json`.
