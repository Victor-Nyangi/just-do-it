# Command palette — design

Date: 2026-08-30
Phase: 12b (the second half of "Quick add & command surface")
Status: approved, not yet implemented

## Problem

Phase 12 shipped its first half — `parseQuickAdd` and the `QuickAddField` that drives it — and left
three boxes unticked:

- Command palette (⌘K), which needs a `command` primitive in `packages/ui`
- Keyboard shortcuts for new task, search, and navigation
- Make quick add reachable from every route, not just Today

The plan deferred these to their own spec. This is that spec.

Two facts about the current build shape the work. There is **no keyboard handling anywhere in the
app** — `grep` for `keydown`, `metaKey` or `onKeyDown` across `apps/just-do-it/src` and
`packages/ui/src` returns nothing — so this introduces the first global key listener and the first
modal surface. And `packages/ui` exports exactly four primitives (`Button`, `Card`, `Badge`,
`Input`) plus `cn`, all hand-written against CSS custom properties, with no runtime UI dependency.

## Scope

**In:**

- A presentational `Command` primitive in `packages/ui`.
- A `command-palette` feature module in the app that supplies commands and wires them up.
- Navigation commands for the eight top-level routes. The two detail routes (`/habits/:habitId`,
  `/lists/:listId`) need an id and so are not palette destinations; they would arrive with entity
  search.
- Action commands: create a task (via quick-add syntax), toggle dark mode.
- ⌘K / Ctrl-K to open, and `g`-then-key chords for direct navigation.

**Out, deliberately:**

- **Entity search.** Typing "atomic" will not find the book in this phase. The primitive and the
  `CommandItem` shape are designed so a later phase can add a `search` group without reworking
  either, but no cross-domain index is built now.
- A persistent quick-add field in the app shell. Quick add becomes reachable everywhere _through
  the palette_, which ticks the plan's third box without putting a form on all nine routes.
- Command history, recents, or fuzzy ranking. Filtering is a plain case-insensitive substring
  match on the label.

## Decisions

### The primitive stays presentational

`packages/ui/src/components/command.tsx` renders a dialog containing a filter input and a grouped,
filterable list. It receives items and callbacks. It imports nothing from the app: no router, no
stores, no domain types.

This matters because `packages/ui` is consumed as raw TypeScript source through the `exports` map
and has no router or store dependency today. A primitive that reached for `useNavigate` would drag
`react-router-dom` into the package and break that.

### Commands are one pure function, not a registry

`buildCommands({ navigate, toggleTheme })` returns `readonly CommandItem[]`. It is a pure function
of its callbacks, so it can be unit-tested without rendering anything.

The alternative — each feature exporting its own commands, composed by a registry — was rejected.
It inverts the dependency rule that keeps the feature graph acyclic (`features/calendar` is the one
module allowed to import other features, strictly one-way), and it is a lot of indirection for ten
commands — eight navigation plus two actions. If the count grows past roughly thirty, revisit.

### `toQuickAddTaskInput` is extracted rather than duplicated

`QuickAddField` currently owns the mapping from a `QuickAddParseResult` to a `TaskInput`, including
the `todo` / `medium` / `Personal` defaults that the parser deliberately does not apply. The palette
needs the same mapping.

Re-implementing it in the palette would recreate exactly the duplicated-invariant problem that
`refactor/single-source-invariants` removed six instances of. So the mapping moves into
`features/tasks` as `toQuickAddTaskInput(parsed)`, and both callers use it. This is the only change
to existing production code in this phase.

### One listener, and it must not hijack typing

`useGlobalShortcuts` attaches a single `keydown` listener to `document`.

- **⌘K / Ctrl-K** opens the palette from anywhere, including while an input is focused. It is
  modified, so it cannot collide with typing.
- **`g` chords** are unmodified single keys, so they must be suppressed when the user is typing.
  The handler ignores them when the event target is an `input`, a `textarea`, or has
  `isContentEditable`.
- The chord window is 1000 ms: press `g`, then the second key. A second key outside the window, or
  any other key, resets the pending state.

### Shortcut map

| Keys  | Goes to            |
| ----- | ------------------ |
| `g t` | `/today`           |
| `g k` | `/tasks`           |
| `g c` | `/calendar`        |
| `g h` | `/habits`          |
| `g b` | `/books`           |
| `g l` | `/lists`           |
| `g g` | `/goals`           |
| `g s` | `/settings`        |
| `⌘K`  | opens the palette  |
| `Esc` | closes the palette |

`g k` rather than `g t` for Tasks because Today claims `t`. The mapping is recorded in `CLAUDE.md`
so it is discoverable without reading the hook.

### Two modes, one input

The palette is a small state machine:

- **`root`** — the filter input filters the command list. Selecting a command runs it and closes the
  palette, with one exception: "New task…" switches mode instead of closing. That exception is why
  `CommandItem.run` returns an optional next mode rather than `void`.
- **`new-task`** — entered by selecting "New task…". The same input now feeds `parseQuickAdd`, with
  the parsed fields previewed beneath it. Enter creates the task and closes; Escape returns to
  `root` rather than closing outright, so a mis-selected command is one key to undo.

## Accessibility

This is the app's first modal, and the recently fixed accessibility debt argues for getting it
right the first time.

- The dialog is `role="dialog"` with `aria-modal="true"` and an `aria-label`.
- Focus moves to the input on open, and returns to whatever was focused before, on close.
- Escape closes from `root`, and steps back to `root` from `new-task`.
- The input is `role="combobox"` with `aria-expanded`, `aria-controls` and `aria-activedescendant`.
  The list is `role="listbox"`; each item is `role="option"` with `aria-selected`.
- **Active-item highlighting uses `aria-activedescendant`, not DOM focus.** Focus stays in the
  input so typing keeps working while arrowing through results.
- Groups are `role="group"` with `aria-label` ("Navigate", "Actions"), so the grouping is not
  conveyed by a heading colour alone.
- The empty state is real text ("No matching commands"), not an empty list.

## Testing

`packages/ui` has no test runner — its `build`, `lint` and `typecheck` scripts are all
`tsc --noEmit` — so the primitive is covered through the app's tests rather than in the package.
That is a known limitation of the package, not a choice made here.

Three layers:

1. **`buildCommands`** — a pure unit test. Every route is reachable; each command's `run` calls the
   callback it should.
2. **`useGlobalShortcuts`** — rendered through a small harness. ⌘K opens; `g t` navigates; `g` then
   a 1500 ms gap then `t` does _not_ navigate; typing `g` inside an input does not navigate.
3. **The palette** — rendered in `AppLayout` under a `MemoryRouter`, queried by role and accessible
   name. Opening, filtering, selecting a navigation command, entering and leaving `new-task` mode,
   creating a task, and the Escape behaviour in both modes.

Tests opt into jsdom per file, pin the clock at midday where a date is involved, and bridge fake
timers into user-event — the conventions in `CLAUDE.md`. The chord-window test needs
`vi.advanceTimersByTime`, which is exactly why that bridge exists.

A mutation check runs before the PR, as on every branch since the calendar work. Mutations worth
trying: drop the typing guard so chords fire inside inputs; widen or remove the chord window; make
Escape close from `new-task` instead of stepping back; have `toQuickAddTaskInput` ignore the parsed
category.

## Verification

`pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` — all from the repo
root, all uncached with `--force`.

A visual check is required for this one and cannot be skipped the way it could on the test-only
branches: this adds a new visible surface. If browser tooling is unavailable in the implementing
session, say so explicitly rather than implying the palette was seen.

## Open question, recorded rather than resolved

`/settings` is still `<PlaceholderPage>`. `g s` will navigate to a page that says nothing. That is
consistent with the existing sidebar, which already links there, so this spec does not treat it as
a blocker — but it is worth noticing that the palette makes the dead end easier to reach.
