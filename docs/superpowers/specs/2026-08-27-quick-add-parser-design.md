# Quick-add natural-language parser — design

Date: 2026-08-27
Phase: 12 (`just-do-it-implementation-plan.md` §7)
Branch: `feat/quick-add-parser`

## Problem

Today's quick add takes a title and nothing else. `TodayPage.addTask` trims the input and hands
`createTask` a hard-coded record — `todo`, `medium`, `Personal`, no due date. Every task created
this way needs a follow-up edit on the Tasks page to become useful, which defeats the point of a
capture field.

The plan (§7, Phase 12) calls for a natural-language parser so `Read 20 pages Friday` produces a
task due Friday rather than a task literally titled "Read 20 pages Friday". It also calls for a
command palette; that is **deliberately deferred to its own phase** (see Scope below).

## Scope

Phase 12 bundles two independently buildable subsystems. This spec covers only the first.

**In scope:** the parser, a live preview, and quick add on both Today and Tasks.

**Out of scope, deferred to a later phase:**

- The command palette, ⌘K, global keyboard shortcuts, and the `command` primitive in
  `packages/ui`. The palette is the right vehicle for "reachable from every route"; building a
  global quick-add bar now would build a surface the palette then replaces.
- **Recurrence parsing** (`every Monday`). `Task` carries `recurrence` and `recurrenceInterval`,
  so it is tempting, but it roughly doubles the grammar and needs its own preview affordance.
- **Description parsing.** There is no natural sigil for it, and quick add is for capture, not
  detail.

## Decisions

Settled during brainstorming, recorded here so the implementation doesn't relitigate them:

1. **Natural words for dates, explicit sigils for category and priority.** `#Reading` and
   `!high`, but `Friday` and `Aug 20`. Keyword inference for category was rejected: "Buy a book
   about workout nutrition" matches both Reading and Workout, and any tie-break there is a
   guess. Dates have no such problem — `Friday` is a date and nothing else.
2. **Matched tokens are stripped from the title.** `Read 20 pages Friday #Reading` yields the
   title `Read 20 pages`, not `Read 20 pages Friday #Reading`.
3. **Live preview; correction is editing the text.** No confirm step, no editable chips. Enter
   commits. The parser stays the single source of truth for what the input means, and quick add
   stays one keystroke — which is the entire reason it exists.
4. **A bare month-day already past rolls forward a year.** `Aug 20` typed on 2026-08-27 means
   2027-08-20. Matches how calendar apps read a bare month-day; quick add is overwhelmingly used
   for upcoming work. The live preview renders the resolved date in full, so an unintended
   11-month jump is visible before commit.
5. **The parser returns no match spans.** An earlier sketch returned `{ kind, text, start, end }`
   ranges for inline highlighting of the input. The approved preview renders a resolved title and
   chips instead, and never highlights the raw text, so the spans have no consumer. Dropped.
6. **The parser applies no defaults.** Every derived field is optional; absent means "not
   specified" and the caller supplies `todo` / `medium` / `Personal`. Policy stays with the
   caller, which keeps the parser a pure text→data function.

## API

New module `apps/just-do-it/src/features/tasks/quick-add-parser.ts`, exported through the
existing `features/tasks/index.ts` barrel. Routes import from `'../features/tasks'`, never the
deeper path.

```ts
export type QuickAddParseResult = {
  title: string;
  dueDate?: string; // ISO yyyy-MM-dd, matching Task['dueDate']
  category?: TaskCategory;
  priority?: TaskPriority;
};

export function parseQuickAdd(input: string, now = new Date()): QuickAddParseResult;
```

`now` is injectable for the same reason every selector's is: date logic that reads the system
clock cannot be tested at a fixed point. This repo has already shipped that bug once —
`getTodaySectionKey` called `isToday()` while accepting a `now` (fixed in `750c81d`). The parser
must take `now` through every date matcher, with no direct `new Date()` below the entry point.

`dueDate` is formatted with `date-fns` `format(date, 'yyyy-MM-dd')` so it satisfies
`taskSchema`'s `isoDateSchema` regex without a second conversion.

## Grammar

Matchers run in a fixed order. Each is handed the remaining text, returns a value plus the span
it consumed, or nothing. A consumed span is cut before the next matcher runs.

### Sigils — first, because they are unambiguous

| Form      | Matched against                          | Example                            |
| --------- | ---------------------------------------- | ---------------------------------- |
| `#<word>` | `TASK_CATEGORY_VALUES`, case-insensitive | `#Reading`, `#reading` → `Reading` |
| `!<word>` | `TASK_PRIORITY_VALUES`, case-insensitive | `!high` → `high`                   |

The values arrays are the single source of truth, exactly as `types.ts` intends — the parser
never carries its own copy of the category or priority vocabulary.

### Dates — after sigils, most specific form first

Order matters: `next Friday` must be attempted before `Friday`, or the bare-weekday matcher
consumes `Friday` and strands `next` in the title.

| #   | Form                           | Example                         | Resolution                           |
| --- | ------------------------------ | ------------------------------- | ------------------------------------ |
| 1   | ISO `yyyy-MM-dd`               | `2026-08-28`                    | as written; must pass `isValid`      |
| 2   | `next <weekday>`               | `next Friday`                   | next strictly-future occurrence      |
| 3   | month-day, either order        | `Aug 20`, `20 Aug`, `August 20` | roll forward a year if past          |
| 4   | bare weekday, full or 3-letter | `Friday`, `fri`                 | next strictly-future occurrence      |
| 5   | relative                       | `today`, `tomorrow`             | `startOfDay(now)`, `addDays(now, 1)` |

### Resolution rules

- **Word boundaries are required.** `\b` anchors on every matcher, so `Monday` does not match
  inside `Mondays` and `Aug` does not match inside `Augment`.
- **Strictly future weekdays.** `Friday` typed on a Friday means the following Friday, following
  `date-fns` `nextFriday`. `today` is the way to say today.
- **First match of each kind wins.** Once a date is found, no further date matcher runs. A second
  `#tag` is left in the title rather than overriding the first — "last one silently wins" is the
  surprising behaviour.
- **An unknown sigil is not a match.** `#Groceries` is not a category, so it stays in the title
  verbatim. Silently dropping input the user typed is worse than leaving it visible.
- **The title is the remainder**, with runs of whitespace collapsed to one space and the result
  trimmed.

### Worked examples

| Input (`now` = Thu 2026-08-27)        | title              | dueDate      | category  | priority |
| ------------------------------------- | ------------------ | ------------ | --------- | -------- |
| `Read 20 pages Friday #Reading !high` | `Read 20 pages`    | `2026-08-28` | `Reading` | `high`   |
| `Workout tomorrow`                    | `Workout`          | `2026-08-28` | —         | —        |
| `Finish portfolio Aug 20`             | `Finish portfolio` | `2027-08-20` | —         | —        |
| `Call the dentist`                    | `Call the dentist` | —            | —         | —        |
| `Email #Groceries`                    | `Email #Groceries` | —            | —         | —        |
| `#Reading`                            | `` (empty)         | —            | `Reading` | —        |

## Preview and the field component

New `apps/just-do-it/src/features/tasks/components/quick-add-field.tsx`.

`features/tasks` already has a `components/` subdirectory, and this clears the repo's
"do not prematurely extract" bar (plan principle 10) the same way `HabitDayGrid` did: two real
consumers on the day it lands, not a speculative third.

The component owns the input state, calls `parseQuickAdd` on every render from the current text,
and renders:

- the resolved title, or a muted hint when it is empty;
- a chip per derived field — due date formatted long (`Fri 28 Aug`), category, priority;
- fields the parser did not set, shown muted as the default that will be applied.

**Empty title after stripping** (the user typed only `#Reading`) disables submission: Enter is a
no-op and the submit button is `disabled`. Creating an untitled task would fail `taskSchema`'s
`.min(1)` and throw.

Existing design-token rules apply — semantic CSS custom properties only, no hex, no Tailwind
palette classes. Yellow stays reserved for time-sensitive meaning, which the due-date chip is.

## Consumers

- `routes/today-page.tsx` — delete the inline `<form>` and the local `addTask`/`newTask` state,
  render `<QuickAddField />` in the existing Quick add `Card`.
- `routes/tasks-page.tsx` — render the same component above the task list.

Both convert through the existing `toTaskInput`. The parse result cannot simply be spread over
the defaults: `TaskEditorValues` requires `dueDate` to be a `string`, and a spread of an optional
field whose key is present but `undefined` overrides the default with `undefined` rather than
falling back to it. Each field is therefore mapped explicitly:

```ts
const parsed = parseQuickAdd(text, now);

createTask(
  toTaskInput({
    ...defaultTaskEditorValues,
    title: parsed.title,
    dueDate: parsed.dueDate ?? '',
    category: parsed.category ?? defaultTaskEditorValues.category,
    priority: parsed.priority ?? defaultTaskEditorValues.priority,
  }),
);
```

This reuses the established fixture→Zod path rather than constructing a `Task` directly, so the
store's `taskSchema.parse` on mutation still guards the write. `toTaskInput` already turns an
empty `dueDate` string into `undefined`, so no second conversion is needed.

## Testing

`quick-add-parser.test.ts`, table-driven with literal expectations and a fixed
`now = new Date(2026, 7, 27)` (Thursday), following `habit-selectors.test.ts`.

Cases:

- one per date matcher, including both month-day orders and the 3-letter weekday form;
- `next Friday` resolving differently from `Friday`, proving matcher order;
- the strictly-future rule: a weekday name typed on that weekday;
- the past month-day roll-forward;
- both sigils, and case-insensitive sigil matching;
- an unknown sigil surviving into the title;
- a second sigil of the same kind being ignored;
- title stripping and whitespace collapse;
- plain text with no matches passing through untouched;
- empty title after stripping;
- empty and whitespace-only input.

**The suite is then mutation-checked.** Characterization tests written against working code pass
on the first run, which proves nothing about whether they can fail. Mutations to apply: swap two
matchers' order, drop a `\b` anchor, flip strictly-future to inclusive, remove the roll-forward,
and make an unknown sigil match. Each must be caught by at least one test.

No component or route test: jsdom and Testing Library are not configured (`vitest.config.ts` sets
`environment: 'node'`), and wiring them belongs to the testing phase. `CLAUDE.md`'s statement
that no route or component is tested stays accurate.

## Work breakdown

One branch, four commits, each green on the full gate:

1. `feat(tasks): add the quick-add parser` — the module and its tests.
2. `feat(tasks): add the quick-add field component` — the component, wired into Today, replacing
   the inline form.
3. `feat(tasks): put quick add on the tasks page` — the second consumer.
4. `docs: record phase 12 parser progress` — tick the parser, inference and preview boxes in plan
   §7, and leave the palette, shortcuts and "reachable from every route" boxes open with a note
   that they are the deferred half. `CLAUDE.md` needs no change here: it already names
   `features/tasks` as owning a `components/` directory, and that stays true.

## Verification

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all green.
- The mutation check above, with every mutation caught.
- Manual check in `pnpm dev`: each worked example above typed into both Today and Tasks produces
  the tabulated task.
