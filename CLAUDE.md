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
- **`pnpm test` runs vitest, and every route now has a rendering test.** All six domains have logic tests: habit selectors, schemas and store; task selectors; goal selectors and store; book store; list selectors and store; the quick-add parser and its `toQuickAddTaskInput` adapter; `features/calendar`'s date-mapping selectors; `features/journeys`'s schemas, plan builder, selectors, store, persistence, export and `journey-api`; `features/sync`'s client and its local-only fallback; and `features/command-palette`'s pure `buildCommands`. On top of those, all fourteen real routes render under test — `/today`, `/tasks`, `/habits`, `/habits/:habitId`, `/lists`, `/lists/:listId`, `/books`, `/goals`, `/calendar`, `/journeys`, `/journeys/:enrollmentId`, `/journeys/:enrollmentId/books`, `/journeys/:enrollmentId/streak`, `/settings` — alongside component-level suites for `QuickAddField`, `CommandPalette`, the `useGlobalShortcuts` hook, `AppLayout`'s mobile drawer, and the `Command` primitive itself (719 tests, 44 files). The primitive is covered from `apps/just-do-it/src/test/ui-command.test.tsx` because `packages/ui` has no vitest of its own; a new primitive gets its test there. `PlaceholderPage` is now unused — every route is real. The `/tasks` suite also exercises `TaskFiltersPanel`, `TaskForm` and `TaskList`, which the route delegates to; `HabitDayGrid` is reached only through the routes that render it, for the reason in the plan's debt list. A passing `build` is still not verification of behavior beyond types.

Component and route tests opt into jsdom per file with a `// @vitest-environment jsdom` docblock —
the default environment stays `node` so the pure-logic suites stay fast. Because vitest takes one
`setupFiles` list for both environments, `src/test/setup.ts` gates all of its work behind
`typeof document !== 'undefined'` and then dynamically imports Testing Library and the feature
barrels: inside the gate it registers jest-dom matchers, cleans up after each test, and resets
every zustand store, since the stores are module singletons that otherwise leak between tests in a
file. **Keep that gate.** Importing those eagerly pulls React and eager fixture parsing into the
eleven pure-logic suites and takes them from ~2.8s to ~4.5s to run ~0.4s of assertions.
`src/test/environment.test.tsx` is the deliberate guard on all of this, not a scratch file — it
fails if the jsdom docblock or the gate ever stops firing. Revisit the arrangement (vitest
`projects` is the next step up, and gives per-environment `setupFiles`) when the DOM setup stops
being cheap enough to load under node.

Three jsdom gaps have already cost time. It does not implement `scrollIntoView` **at all** — not
even as a no-op — so `vi.spyOn` cannot wrap it and it has to be assigned outright
(`Element.prototype.scrollIntoView = vi.fn()`), or anything calling it throws; `/tasks` needs this
for its edit flow. And it does not support text selection on `type="number"` inputs, so neither
`{selectall}` nor `user.clear()` can replace their contents — typing appends instead, and
`fireEvent.change` is the honest way to set them. Third, jsdom _does_ implement interactive form
validation, so a `required` field that is empty blocks the submit event entirely — the handler
never runs, which is why several routes' own "is this field filled" guards are unreachable from a
test (and from a user).

A route with a dynamic segment has to be mounted through `Routes`/`Route` with `initialEntries`
rather than a bare `MemoryRouter`, or `useParams` resolves nothing — `habit-detail-page.test.tsx`
is the worked example, and it stubs `/habits` as a second route so post-delete navigation is
observable. Query by role and accessible name; the routes already carry good ones. One component defeats
this and it is worth knowing before you try: `HabitDayGrid` sets `aria-hidden="true"` on its root
and encodes completion purely as a background colour, so it is unreachable by role or name and
untestable without asserting on Tailwind classes. Cover it through a route that renders it, and see
the plan's debt list for the underlying accessibility issue. **Any test that pins the
clock must bridge it into user-event**, and both halves are load-bearing:

```ts
vi.useFakeTimers({ shouldAdvanceTime: true });
const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
```

user-event hangs on unbridged fake timers. Five routes — `calendar`, `today`, `habits`,
`habit-detail` and `goals` — read `new Date()` directly, so any test rendering one of them needs a
pinned clock and therefore needs this. Pin to midday rather than midnight, so that the clock
creeping forward under `shouldAdvanceTime` cannot roll the date over.

One more trap for date-driven routes: the fixtures only span **May–September 2026** — except `features/journeys`, whose seeded enrollment runs **12 September – 20 December 2026**, so a clock pinned for a journey route is pinned outside every other domain's data and vice versa. A journey route also needs mounting through `Routes`/`Route` with `initialEntries`, since every one of them takes an `:enrollmentId`. A test pinned
outside that window renders every empty state and nothing else, which is fine for asserting
structure and useless for asserting content — `calendar-page.test.tsx` pins December for the grid
and navigation, and August for the tests that need real data.

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

All edits are session-local by design; nothing persists across a reload (except the theme, and journeys — see below). Don't add localStorage persistence or a fetch layer to another domain without being asked.

**`features/journeys` is the one domain that persists**, because a hundred-day tracker whose ticks vanish on reload is useless. `journey-persistence.ts` writes to `localStorage` on every store mutation and seeds the store at boot. The merge rule is the important part: **the repo is authoritative for what a journey _is_, storage is authoritative for what has been done about it.** Journey definitions are never persisted, so editing `journeys.json` and deploying reaches a browser that already has state; enrollments and completions come from storage whenever a stored blob exists at all — presence, not emptiness, decides, so a journey that was left stays left. Stored state is treated as untrusted (an older build wrote it, or devtools did): it goes through the same Zod schemas and is discarded wholesale on any failure, and every `localStorage` access is wrapped, since a private window throws rather than returning null.

The deployed site is static, so **the browser cannot write back to the repo** — `src/data/*.json` is bundled into the JS at build time. `journey-export.ts` and the streak page's `JourneyExportCard` close that gap deliberately: they emit the exact contents of `journey-completions.json` for a human to paste and commit, which is what makes a day's progress public and carries it to another device. Two things make that loop trustworthy and must be preserved together — completion ids are derived from `(enrollmentId, dayIndex, activityId)` rather than `crypto.randomUUID()` (a deliberate exception to the ID convention, and the same triple planned as the row's primary key), and the export is sorted by that triple. The committed fixture is itself already in canonical export order, so committing an unchanged day diffs to nothing; `journey-export.test.ts` guards that, and it fails if the fixture is ever hand-edited out of order.

**`src/data/journey-completions.json` is a record, not a fixture.** It is the one data file the app exists to change — a row lands in it every day the journey is lived — so **nothing in the test suite may depend on its contents**. Seeding the store from it once coupled every journey suite to one morning's progress, and committing a real day turned CI red, which is exactly backwards. Tests seed from the fixed baseline in `src/test/journey-baseline.ts` instead (`setup.ts` for the jsdom suites, `seedJourneyStore()` for the four node ones), `countUncommittedChanges` takes an injectable committed set for the same reason selectors take an injectable `now`, and the suites that must touch the real record assert invariants over it — every completion points at a seeded enrollment, its id is the `(enrollment, day, activity)` triple, the file is in canonical export order — never the rows it holds today. `journey-enrollments.json` and `journeys.json` are ordinary fixtures and may be asserted on directly; they are definitions and do not move. Verify a change here by planting a few plausible days in the record and re-running: green on an empty record alone proves nothing.

The third thing the loop depends on is **re-keying**. `journey-completions.json` is keyed on the enrollment the repo publishes (`enrollment-discipline`), and the run a browser is actually ticking almost never carries that id — the server generates it when signed in, and `crypto.randomUUID()` does for a second local run. So `JourneyExportCard` takes the enrollment it is publishing, maps its completions onto the committed id through `rekeyCompletionsForExport`, and offers no export at all for a journey the repo publishes no run of. Exporting the raw store instead writes completions pointing at an unknown enrollment, which the referential check in `journey-data.ts` throws on **at module load** — so the mistake white-screens the deployed app on boot rather than failing a render. Re-keying is sound because an activity id depends only on the journey and the day index; the enrollment supplies the calendar date and nothing else. Where the two start dates differ, the card says so, because day one then publishes as a different calendar day.

`features/journeys/journey-api.ts` is the one apparent exception, and is not one: the domain was specified as three HTTP endpoints, now scoped to an enrollment (`GET /api/enrollments/[id]/day/[dayIndex]`, `POST /api/enrollments/[id]/day/[dayIndex]/complete`, `GET /api/enrollments/[id]/stats`), and that module keeps their contracts — the same addressing, the same response shapes, toggle semantics on complete, `null` standing in for a 404 — while running in-process against the store. It adds no fetch layer and no persistence. Moving journeys behind a real API means rewriting those three function bodies and touching nothing that calls them.

The backend this is aimed at is Cloudflare Workers + D1, with `journeys(id, owner_id, title, definition JSON, ...)`, `enrollments(id, user_id, journey_id, start_date, ...)` and `completions(enrollment_id, day_index, activity_id, completed_at)` keyed on that triple — which is what makes a toggle safe to retry. The journey _definition_ stays a single validated JSON document rather than five normalised tables, because nothing ever queries inside it; `journeySchema` is already exactly that validator. The client completion type omits `user_id` on purpose, because that column belongs to the authenticated session rather than to anything the client should be asserting.

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
- `features/journeys` is the one domain whose data is **generated rather than stored**, and the one with a three-part model. A **journey** is a definition — what a day looks like and how many days there are — and deliberately carries no start date; an **enrollment** is someone running that journey from a given date; **completions** hang off the enrollment. That split is what lets the same journey be started twice, or by different people, without the runs colliding, and it is why every selector takes an `EnrolledJourney` pair rather than a journey.

  The day plans are not fixtures. `journey-plan.ts` derives them from the definition and the day index as a pure function: the physical rotation by `(dayIndex - 1) % 7`, and each track's book by a seeded Fisher-Yates permutation of that track's list, reshuffled per cycle so every book still comes up exactly once per pass. That determinism is load-bearing, not decorative: a completion row points at an activity id like `day-4-growth-reading`, so a plan that changed between renders would silently re-point it. `journey-store.ts` is therefore the only place that can tell a real activity id from an invented one, and it checks the generated plan before writing.

  Every part of a journey is optional except that it must schedule _something_ — `journeySchema` refuses a definition with no physical work, no books and no reflection, because otherwise every one of its days would be vacuously complete. The `deep-work-reset` fixture exists to keep that generality honest: a different length, an empty rotation and a single reading track, so a custom journey cannot be the first thing to exercise those paths. `journey-api.ts` is the third unusual piece — see above.

  One trap worth knowing: `useJourneyEnrollment` and `useJourneyById` look like they want to be a single `useEnrolledJourney` returning the pair, and must not be. Zustand v5 compares snapshots by reference, so a selector building `{ enrollment, journey }` returns a fresh object on every store read and re-renders forever. Each hook returns an element that already lives in the store's array; the route composes the pair locally.

- `features/auth` wraps Clerk, and its whole design turns on one fact: **whether this app has auth is a build-time constant.** `VITE_CLERK_PUBLISHABLE_KEY` is inlined by Vite, so `isClerkConfigured` never changes between renders. Without a key, `AuthProvider` renders its children untouched and the app is exactly what it was before auth existed — fixtures plus localStorage — which is what a portfolio visitor who never signs in should get, and what a deploy with a missing variable must degrade to rather than white-screening (`ClerkProvider` throws on an empty key).

  Clerk's hooks only work inside a `ClerkProvider`, and calling them conditionally would break the rules of hooks — oxlint rejects it, correctly. The resolution is `auth-context.ts`: a `ClerkAuthBridge` mounts only when there is a key, calls the Clerk hooks, and publishes an `AuthSnapshot` through context; the contexts carry unconfigured defaults otherwise. Every consumer then calls `useContext` unconditionally. **Do not collapse that back into a conditional hook call with a lint suppression.**

  `useAuthTokenGetter` returns a function that fetches a fresh token per call rather than caching one — Clerk session tokens are short-lived and a cached one starts failing about a minute in. It resolves to `null` when there is no key or nobody is signed in, which the sync layer reads as "stay local" rather than "retry".

  One guard is deliberately loud: a `VITE_CLERK_PUBLISHABLE_KEY` starting `sk_` replaces the app with an error page. By then the secret is already in the bundle and cannot be un-leaked, so the only useful job left is making the mistake impossible to miss and putting "rotate it" first.

- `features/sync` is the only feature that imports other features, and the direction is the whole point: **sync → journeys and sync → auth, never back.** `features/journeys` knows nothing about auth or the API, which is what keeps it usable with no server at all. Routes compose the two, which the architecture explicitly allows a route to do and a feature not to.

  The seam is a pair of hooks rather than a change to the store. `useSyncedToggleActivity`, `useSyncedEnrollInJourney` and `useSyncedLeaveJourney` wrap the raw store actions; routes call these instead. When there is no `VITE_API_URL`, or no Clerk key, or nobody signed in, they fall through to the store action and **make no request at all** — verified in a browser, not just asserted. That path is the portfolio visitor and any deploy with a missing variable, and it must stay transparent.

  Two store actions exist solely for this: `adoptServerState` (hydration) and `adoptEnrollment`. Both re-`parse()` through the Zod schemas like every other mutation, because a server response is no more trusted than a fixture.

  Signing in does **not** destroy the local record. `localStorage` still holds it, so signing out returns to it — the two are separate stores of the same shape, and which is authoritative depends only on whether there is a session.

  Enrolment is the one action that cannot be optimistic: **the server owns enrollment identity**, so it round-trips and the returned row is adopted. A completion written against a locally invented id would point at nothing once the real id arrived. Toggling is optimistic, because a checklist that waited for a round trip would feel broken on a phone — and the server's toggle is idempotent on `(enrollment, day, activity)`, so a retry cannot double it. Letting the client choose the enrollment id was tried and reverted: `enrollments.id` is a global primary key, so a client-chosen id can collide across users and 500.

- `features/calendar` is the only domain with **no store and no hooks**. It owns no state — the
  selected month is `useState` in the route — and every export is a pure function over data from
  the other three domains. Its absence of a store is deliberate, not an oversight.
- The plan's sketch of `src/{components,lib,stores,types}/` was deliberately not built; stores and types live inside their feature.

Routing is flat in `App.tsx` under a single `AppLayout` outlet, with nested dynamic routes for habit and list detail (`/habits/:habitId`, `/lists/:listId`) and three enrollment-scoped journey routes (`/journeys/:enrollmentId`, plus `/books` and `/streak` under it) beneath the `/journeys` dashboard. `/challenge` is a redirect to `/journeys`, kept because the challenge shipped before journeys generalised it. `/settings` is a real diagnostics page now, not a placeholder. Unknown paths redirect to `/today`.

### Design system

`packages/ui` (`@just-do-it/ui`) exports four primitives — `Button`, `Card`, `Badge`, `Input` — plus `cn` (clsx + tailwind-merge). Consumed as raw TypeScript source via the `exports` map.

Theming is **CSS custom properties, not Tailwind theme colors**. `packages/ui/src/styles.css` defines the full semantic palette on `:root` and overrides it under `:root[data-theme='dark']`; components reference them as arbitrary values (`bg-[var(--primary)]`, `text-[var(--muted-foreground)]`). Add a new color by adding a token to _both_ blocks — never hard-code a hex or a Tailwind palette class in a component.

Semantics carry meaning and shouldn't be swapped for aesthetics: green = primary/success, purple = accent action, yellow = warning/time-sensitive only.

Tailwind v4 is configured entirely in CSS (`@tailwindcss/vite`, no `tailwind.config`). The app's `src/styles.css` imports the UI stylesheet and declares `@source "../../../packages/ui/src"` so Tailwind scans the package — if a class only used inside `packages/ui` goes missing at runtime, that directive is why.

Dark mode is a `useState` in `AppLayout` writing `document.documentElement.dataset.theme` and `localStorage['theme']`. There is no context provider; anything else needing the theme should read the same key.

### Keyboard shortcuts

`features/command-palette` owns the only global key listener in the app; `AppLayout` mounts
`<CommandPalette />` once and passes it the theme toggler. `⌘K` / `Ctrl-K` opens the palette from
anywhere, including from inside a text field, because it is modified and so cannot collide with
typing.

Navigation chords are `g` then a key: `t` Today, `j` Journeys, `k` Tasks, `c` Calendar, `g` Goals,
`h` Habits, `b` Books, `l` Lists, `s` Settings. `k` rather than `t` for Tasks because Today claims `t`.
`NAVIGATION_CHORDS` in `commands.ts` is the single source of truth — `buildCommands` reads it to
advertise each hint, so a route can never be offered under a chord that does not work.

**Chords are suppressed whenever the event target is an `input`, `textarea`, or contenteditable.**
Without that guard, typing "goals" into the quick-add field navigates away mid-word. Any new
unmodified shortcut needs the same guard.

The palette's active option is tracked with `aria-activedescendant` rather than by moving DOM
focus, so typing keeps working while arrowing through results.

## Conventions

- Variable names are spelled out (`leftTask`/`rightTask` in comparators, `existingList`, `normalizedValue`) — no single-letter or abbreviated identifiers. Match that.
- Icons come from `lucide-react`, dates from `date-fns` (`parseISO`, `isToday`, `startOfDay` — no hand-rolled date math), IDs from `crypto.randomUUID()`.
- Commits are Conventional Commits scoped by domain (`feat(books):`, `refactor(features):`), one branch per plan phase (`feat/static-lists`, `feat/today-dashboard`), rebased onto `main` rather than merged — the history is linear and the old phase branches are left behind as duplicates. Check `git branch --show-current`; `main` is the integration branch.
- Fixtures are POC-only: no real user data or secrets in `src/data/*.json`.
