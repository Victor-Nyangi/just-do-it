# Quick-Add Parser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the title-only quick-add field into a natural-language parser, so `Read 20 pages Friday #Reading !high` creates a task titled "Read 20 pages" due Friday, categorised Reading, at high priority.

**Architecture:** One pure function `parseQuickAdd(input, now)` in `features/tasks/`, built as an ordered pipeline of matchers — sigils first (unambiguous), then dates (most specific form first). Each matcher returns a value plus the span it consumed; consumed spans are cut and the remainder becomes the title. A shared `QuickAddField` component renders the live preview and is used by both the Today and Tasks routes.

**Tech Stack:** TypeScript, React 19, Zustand, Zod, date-fns 4.1, vitest, Tailwind v4 (CSS-configured), pnpm 10 + Turborepo.

**Spec:** `docs/superpowers/specs/2026-08-27-quick-add-parser-design.md`

## Global Constraints

- **Run every command from the repo root**, not from `apps/just-do-it`. Commands are `pnpm dev`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm format`.
- **Run `pnpm format` before every commit.** There is no pre-commit hook; CI fails on drift. Prettier config: semicolons, single quotes, trailing commas, 100 columns.
- **Variable names are spelled out.** No single-letter or abbreviated identifiers — `leftTask`/`rightTask`, `existingList`, `normalizedValue`. Match that style.
- **Dates come from `date-fns`.** No hand-rolled date maths. IDs from `crypto.randomUUID()`. Icons from `lucide-react`.
- **Any function doing date logic takes an injectable `now = new Date()`** and threads it through every helper. Never call `new Date()` below the entry point. This repo has already shipped that bug once (`getTodaySectionKey` called `isToday()` while accepting a `now`; fixed in `750c81d`).
- **Colours are CSS custom properties only** — `bg-[var(--primary)]`, `text-[var(--muted-foreground)]`. Never a hex value, never a Tailwind palette class. Yellow/`--warning` is reserved for time-sensitive meaning.
- **`features/tasks/index.ts` is an explicit named-export barrel.** No `export *`. Anything a route needs must be added there; routes import from `'../features/tasks'`, never a deeper path.
- **Commits are Conventional Commits scoped by domain**, e.g. `feat(tasks):`. One branch for the phase: `feat/quick-add-parser`, already created.
- **Test expectations are hand-written literals.** Never compute an expected value using the code under test.

### Regex constraints — two verified traps

1. **Never backslash-escape `#` or `!` inside a `u`-flag regex.** `new RegExp('\\#(\\w+)', 'gu')` throws `Invalid regular expression: Invalid escape`. Both characters are literals in regex; write them bare: `new RegExp('#(\\w+)', 'gu')`.
2. **Use one combined alternation for weekdays, not a loop over weekdays.** Looping returns the first weekday in _list_ order, not the first in the _text_: `Call Friday about Monday` would resolve to Monday. A single `\b(?:sunday|sun|monday|mon|…)\b` returns `Friday` at index 5, which is correct.

Within each alternation, **longer forms come first** (`sunday|sun`, `august|aug`), or the short form matches a prefix and strands the rest of the word in the title.

### Verified date-fns behaviour

Confirmed by probe against date-fns 4.1 — rely on these, do not re-derive:

| Call                               | Result                                                     |
| ---------------------------------- | ---------------------------------------------------------- |
| `nextDay(Thu 2026-08-27, 5)`       | `2026-08-28` (that Friday)                                 |
| `nextDay(Fri 2026-08-28, 5)`       | `2026-09-04` — **strictly future**, never the same day     |
| `parse('Aug 20', 'MMMM d', now)`   | `2026-08-20` — `MMMM` accepts the **abbreviated** form too |
| `parse('August 20', 'MMM d', now)` | **INVALID** — `MMM` rejects the long form                  |
| `parse('20 Aug', 'd MMMM', now)`   | `2026-08-20`                                               |

So only two month-day formats are needed: `MMMM d` and `d MMMM`. Do not add `MMM d`.

---

### Task 1: The parser module

**Files:**

- Create: `apps/just-do-it/src/features/tasks/quick-add-parser.ts`
- Create: `apps/just-do-it/src/features/tasks/quick-add-parser.test.ts`
- Modify: `apps/just-do-it/src/features/tasks/index.ts`

**Interfaces:**

- Consumes: `TASK_CATEGORY_VALUES`, `TASK_PRIORITY_VALUES`, `TaskCategory`, `TaskPriority` from `./types`.
- Produces: `parseQuickAdd(input: string, now?: Date): QuickAddParseResult` and the exported type `QuickAddParseResult = { title: string; dueDate?: string; category?: TaskCategory; priority?: TaskPriority }`, both re-exported from `features/tasks/index.ts`. `dueDate` is either a valid ISO `yyyy-MM-dd` string or `undefined` — never an empty string, never a `Date`. Task 2 mutation-checks this suite; Task 3 consumes `parseQuickAdd` through the barrel.

- [ ] **Step 1: Write the failing test — plain text and sigils**

Create `apps/just-do-it/src/features/tasks/quick-add-parser.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { parseQuickAdd } from './quick-add-parser';

const now = new Date(2026, 7, 27); // Thursday 2026-08-27, local time

describe('parseQuickAdd — plain text', () => {
  it('returns the whole input as the title when nothing matches', () => {
    expect(parseQuickAdd('Call the dentist', now).title).toBe('Call the dentist');
  });

  it('derives no fields from plain text', () => {
    const parsed = parseQuickAdd('Call the dentist', now);

    expect(parsed.dueDate).toBeUndefined();
    expect(parsed.category).toBeUndefined();
    expect(parsed.priority).toBeUndefined();
  });

  it('trims surrounding whitespace', () => {
    expect(parseQuickAdd('   Call the dentist   ', now).title).toBe('Call the dentist');
  });

  it('collapses runs of whitespace', () => {
    expect(parseQuickAdd('Call    the   dentist', now).title).toBe('Call the dentist');
  });

  it('returns an empty title for empty input', () => {
    expect(parseQuickAdd('', now).title).toBe('');
  });

  it('returns an empty title for whitespace-only input', () => {
    expect(parseQuickAdd('    ', now).title).toBe('');
  });
});

describe('parseQuickAdd — category sigil', () => {
  it('reads a category and strips it from the title', () => {
    const parsed = parseQuickAdd('Finish the chapter #Reading', now);

    expect(parsed.category).toBe('Reading');
    expect(parsed.title).toBe('Finish the chapter');
  });

  it('matches a category case-insensitively', () => {
    expect(parseQuickAdd('Finish the chapter #reading', now).category).toBe('Reading');
  });

  it('leaves an unknown category in the title', () => {
    const parsed = parseQuickAdd('Email #Groceries', now);

    expect(parsed.category).toBeUndefined();
    expect(parsed.title).toBe('Email #Groceries');
  });

  it('keeps the first of two categories and leaves the second in the title', () => {
    const parsed = parseQuickAdd('Plan #Reading #Workout', now);

    expect(parsed.category).toBe('Reading');
    expect(parsed.title).toBe('Plan #Workout');
  });

  it('skips an unknown sigil to find a real category later in the text', () => {
    const parsed = parseQuickAdd('Email #Groceries #Errand', now);

    expect(parsed.category).toBe('Errand');
    expect(parsed.title).toBe('Email #Groceries');
  });
});

describe('parseQuickAdd — priority sigil', () => {
  it('reads a priority and strips it from the title', () => {
    const parsed = parseQuickAdd('Ship the release !urgent', now);

    expect(parsed.priority).toBe('urgent');
    expect(parsed.title).toBe('Ship the release');
  });

  it('matches a priority case-insensitively', () => {
    expect(parseQuickAdd('Ship the release !URGENT', now).priority).toBe('urgent');
  });

  it('leaves an unknown priority in the title', () => {
    const parsed = parseQuickAdd('Ship the release !yesterday', now);

    expect(parsed.priority).toBeUndefined();
    expect(parsed.title).toBe('Ship the release !yesterday');
  });

  it('reads both sigils from one input', () => {
    const parsed = parseQuickAdd('Ship the release #Hobby !high', now);

    expect(parsed.category).toBe('Hobby');
    expect(parsed.priority).toBe('high');
    expect(parsed.title).toBe('Ship the release');
  });

  it('returns an empty title when the input is only a sigil', () => {
    const parsed = parseQuickAdd('#Reading', now);

    expect(parsed.category).toBe('Reading');
    expect(parsed.title).toBe('');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @just-do-it/app exec vitest run src/features/tasks/quick-add-parser.test.ts`

Expected: FAIL — `Failed to resolve import "./quick-add-parser"`. The module does not exist yet.

- [ ] **Step 3: Implement the sigil matching**

Create `apps/just-do-it/src/features/tasks/quick-add-parser.ts`:

```ts
import {
  TASK_CATEGORY_VALUES,
  TASK_PRIORITY_VALUES,
  type TaskCategory,
  type TaskPriority,
} from './types';

export type QuickAddParseResult = {
  title: string;
  dueDate?: string;
  category?: TaskCategory;
  priority?: TaskPriority;
};

type Match<TValue> = {
  value: TValue;
  start: number;
  end: number;
};

// `#` and `!` are literals in a regex. Escaping either one under the `u` flag
// throws "Invalid escape", so the sigil is interpolated bare.
function matchSigil<TValue extends string>(
  text: string,
  sigil: '#' | '!',
  allowedValues: readonly TValue[],
): Match<TValue> | null {
  const pattern = new RegExp(`${sigil}(\\w+)`, 'gu');

  for (const candidate of text.matchAll(pattern)) {
    const word = candidate[1].toLowerCase();
    const matchedValue = allowedValues.find((allowed) => allowed.toLowerCase() === word);

    if (matchedValue !== undefined) {
      return {
        value: matchedValue,
        start: candidate.index,
        end: candidate.index + candidate[0].length,
      };
    }
  }

  return null;
}

// Spans are cut back-to-front so that removing one does not shift the indices
// of the ones still to be removed.
function cutSpans(
  text: string,
  spans: ReadonlyArray<{ start: number; end: number } | null>,
): string {
  return spans
    .filter((span) => span !== null)
    .sort((leftSpan, rightSpan) => rightSpan.start - leftSpan.start)
    .reduce((remaining, span) => remaining.slice(0, span.start) + remaining.slice(span.end), text);
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

export function parseQuickAdd(input: string, now = new Date()): QuickAddParseResult {
  const categoryMatch = matchSigil(input, '#', TASK_CATEGORY_VALUES);
  const priorityMatch = matchSigil(input, '!', TASK_PRIORITY_VALUES);

  return {
    title: collapseWhitespace(cutSpans(input, [categoryMatch, priorityMatch])),
    dueDate: undefined,
    category: categoryMatch?.value,
    priority: priorityMatch?.value,
  };
}
```

`now` is not used yet — Step 8 consumes it. Keep the parameter: the spec's API is
`parseQuickAdd(input, now)` and the tests already pass a second argument.

**Do not run `pnpm typecheck` between here and Step 8.** `tsconfig.app.json` sets
`noUnusedParameters: true`, so an unused `now` is `error TS6133: 'now' is declared but its value
is never read`. Steps 4 and 9 run vitest only, which strips types without checking them. The full
gate runs once, at Step 10, by which point `now` is used. This is exactly why the sigil and date
work is one task and one commit rather than two.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @just-do-it/app exec vitest run src/features/tasks/quick-add-parser.test.ts`

Expected: PASS — 16 tests. The date tests do not exist yet; they arrive in Step 6.

- [ ] **Step 5: Export from the barrel**

In `apps/just-do-it/src/features/tasks/index.ts`, add the value export. The file groups exports by source module and keeps each group alphabetised — add a new group after the `./task-selectors` group:

```ts
export { parseQuickAdd } from './quick-add-parser';
```

and add the type to the existing type exports:

```ts
export type { QuickAddParseResult } from './quick-add-parser';
```

- [ ] **Step 6: Write the failing date tests**

Append to `apps/just-do-it/src/features/tasks/quick-add-parser.test.ts`:

```ts
describe('parseQuickAdd — relative dates', () => {
  it('resolves "today" to the injected now', () => {
    expect(parseQuickAdd('Pay the bill today', now).dueDate).toBe('2026-08-27');
  });

  it('resolves "tomorrow" to the following day', () => {
    expect(parseQuickAdd('Pay the bill tomorrow', now).dueDate).toBe('2026-08-28');
  });

  it('strips the matched date from the title', () => {
    expect(parseQuickAdd('Pay the bill tomorrow', now).title).toBe('Pay the bill');
  });

  it('matches a date word case-insensitively', () => {
    expect(parseQuickAdd('Pay the bill Tomorrow', now).dueDate).toBe('2026-08-28');
  });

  it('does not match a date word inside a longer word', () => {
    const parsed = parseQuickAdd('Review the todayish draft', now);

    expect(parsed.dueDate).toBeUndefined();
    expect(parsed.title).toBe('Review the todayish draft');
  });
});

describe('parseQuickAdd — weekdays', () => {
  it('resolves a weekday to its next occurrence', () => {
    expect(parseQuickAdd('Read 20 pages Friday', now).dueDate).toBe('2026-08-28');
  });

  it('accepts the three-letter form', () => {
    expect(parseQuickAdd('Read 20 pages fri', now).dueDate).toBe('2026-08-28');
  });

  it('resolves a weekday that is today to the following week', () => {
    // `now` is a Thursday. "Thursday" therefore means next Thursday, not today.
    expect(parseQuickAdd('Standup Thursday', now).dueDate).toBe('2026-09-03');
  });

  it('resolves "next <weekday>" the same way as the bare weekday', () => {
    expect(parseQuickAdd('Read 20 pages next Friday', now).dueDate).toBe('2026-08-28');
  });

  it('strips the whole "next <weekday>" phrase, leaving no stray "next"', () => {
    expect(parseQuickAdd('Read 20 pages next Friday', now).title).toBe('Read 20 pages');
  });

  it('uses the leftmost weekday when two appear', () => {
    // Friday is 5 and Monday is 1, so a per-weekday loop would wrongly pick Monday.
    expect(parseQuickAdd('Call Friday about Monday', now).dueDate).toBe('2026-08-28');
  });
});

describe('parseQuickAdd — month and day', () => {
  it('reads an abbreviated month before the day', () => {
    expect(parseQuickAdd('Finish portfolio Dec 25', now).dueDate).toBe('2026-12-25');
  });

  it('reads a full month name', () => {
    expect(parseQuickAdd('Finish portfolio December 25', now).dueDate).toBe('2026-12-25');
  });

  it('reads the day before the month', () => {
    expect(parseQuickAdd('Finish portfolio 25 Dec', now).dueDate).toBe('2026-12-25');
  });

  it('rolls a past month-day forward to next year', () => {
    // `now` is 2026-08-27, so 20 August has already gone.
    expect(parseQuickAdd('Finish portfolio Aug 20', now).dueDate).toBe('2027-08-20');
  });

  it('does not roll a future month-day forward', () => {
    expect(parseQuickAdd('Finish portfolio Aug 28', now).dueDate).toBe('2026-08-28');
  });

  it('strips the matched month-day from the title', () => {
    expect(parseQuickAdd('Finish portfolio Aug 20', now).title).toBe('Finish portfolio');
  });
});

describe('parseQuickAdd — ISO dates', () => {
  it('reads an ISO date as written', () => {
    expect(parseQuickAdd('Renew the licence 2026-11-30', now).dueDate).toBe('2026-11-30');
  });

  it('strips the ISO date from the title', () => {
    expect(parseQuickAdd('Renew the licence 2026-11-30', now).title).toBe('Renew the licence');
  });

  it('leaves an impossible ISO date in the title', () => {
    const parsed = parseQuickAdd('Renew the licence 2026-13-45', now);

    expect(parsed.dueDate).toBeUndefined();
    expect(parsed.title).toBe('Renew the licence 2026-13-45');
  });
});

describe('parseQuickAdd — matcher precedence', () => {
  it('prefers an ISO date over a weekday appearing later', () => {
    expect(parseQuickAdd('Ship 2026-11-30 by Monday', now).dueDate).toBe('2026-11-30');
  });

  it('keeps only the first date and leaves the second in the title', () => {
    const parsed = parseQuickAdd('Ship today or tomorrow', now);

    expect(parsed.dueDate).toBe('2026-08-27');
    expect(parsed.title).toBe('Ship or tomorrow');
  });

  it('reads a date and both sigils together', () => {
    const parsed = parseQuickAdd('Read 20 pages Friday #Reading !high', now);

    expect(parsed).toEqual({
      title: 'Read 20 pages',
      dueDate: '2026-08-28',
      category: 'Reading',
      priority: 'high',
    });
  });

  it('does not read a date out of the category sigil', () => {
    // Without masking sigils first, "#Monday" would be scanned for a weekday.
    const parsed = parseQuickAdd('Plan the week #Monday', now);

    expect(parsed.dueDate).toBeUndefined();
    expect(parsed.title).toBe('Plan the week #Monday');
  });
});
```

- [ ] **Step 7: Run the tests to verify the new ones fail**

Run: `pnpm --filter @just-do-it/app exec vitest run src/features/tasks/quick-add-parser.test.ts`

Expected: FAIL — every new date assertion reports `expected undefined to be '2026-08-28'` and similar. The 17 tests from Task 1 still pass.

- [ ] **Step 8: Implement the date matchers**

In `apps/just-do-it/src/features/tasks/quick-add-parser.ts`, add the date-fns import at the top of the file, above the `./types` import:

```ts
import { addDays, addYears, format, isValid, nextDay, parse, startOfDay, type Day } from 'date-fns';
```

Add these declarations after the `Match` type:

```ts
// Longer forms first in every alternation: `sun` before `sunday` would match the
// prefix of "sunday" and strand "day" in the title.
const WEEKDAYS: ReadonlyArray<{ pattern: string; day: Day }> = [
  { pattern: 'sunday|sun', day: 0 },
  { pattern: 'monday|mon', day: 1 },
  { pattern: 'tuesday|tue', day: 2 },
  { pattern: 'wednesday|wed', day: 3 },
  { pattern: 'thursday|thu', day: 4 },
  { pattern: 'friday|fri', day: 5 },
  { pattern: 'saturday|sat', day: 6 },
];

const ANY_WEEKDAY = WEEKDAYS.map((weekday) => weekday.pattern).join('|');

const ANY_MONTH =
  'january|february|march|april|may|june|july|august|september|october|november|december|' +
  'jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec';

type TextSpan = { text: string; start: number; end: number };

function findFirst(text: string, pattern: RegExp): TextSpan | null {
  const found = pattern.exec(text);

  if (!found) return null;

  return { text: found[0], start: found.index, end: found.index + found[0].length };
}

function resolveWeekday(phrase: string, now: Date): Date | null {
  const weekday = WEEKDAYS.find((candidate) =>
    new RegExp(`(?:${candidate.pattern})$`, 'iu').test(phrase),
  );

  // `nextDay` is strictly future: a weekday naming today resolves to next week.
  return weekday ? startOfDay(nextDay(now, weekday.day)) : null;
}

function matchDate(text: string, now: Date): Match<Date> | null {
  const isoSpan = findFirst(text, /\b\d{4}-\d{2}-\d{2}\b/u);

  if (isoSpan) {
    const parsed = parse(isoSpan.text, 'yyyy-MM-dd', now);

    if (isValid(parsed)) {
      return { value: startOfDay(parsed), start: isoSpan.start, end: isoSpan.end };
    }
  }

  // "next Friday" must be tried before the bare weekday, or the bare matcher
  // consumes "Friday" and strands "next" in the title.
  const nextWeekdaySpan = findFirst(text, new RegExp(`\\bnext\\s+(?:${ANY_WEEKDAY})\\b`, 'iu'));

  if (nextWeekdaySpan) {
    const resolved = resolveWeekday(nextWeekdaySpan.text, now);

    if (resolved) {
      return { value: resolved, start: nextWeekdaySpan.start, end: nextWeekdaySpan.end };
    }
  }

  const monthDaySpan =
    findFirst(text, new RegExp(`\\b(?:${ANY_MONTH})\\s+\\d{1,2}\\b`, 'iu')) ??
    findFirst(text, new RegExp(`\\b\\d{1,2}\\s+(?:${ANY_MONTH})\\b`, 'iu'));

  if (monthDaySpan) {
    // `MMMM` accepts the abbreviated month too, so these two cover all four
    // spellings. `MMM d` would reject "August 20" and is deliberately absent.
    for (const dateFormat of ['MMMM d', 'd MMMM']) {
      const parsed = parse(monthDaySpan.text, dateFormat, now);

      if (isValid(parsed)) {
        const atStartOfDay = startOfDay(parsed);
        const resolved = atStartOfDay < startOfDay(now) ? addYears(atStartOfDay, 1) : atStartOfDay;

        return { value: resolved, start: monthDaySpan.start, end: monthDaySpan.end };
      }
    }
  }

  // One combined alternation, so the leftmost weekday in the text wins. Looping
  // over WEEKDAYS instead would return the first in list order.
  const weekdaySpan = findFirst(text, new RegExp(`\\b(?:${ANY_WEEKDAY})\\b`, 'iu'));

  if (weekdaySpan) {
    const resolved = resolveWeekday(weekdaySpan.text, now);

    if (resolved) {
      return { value: resolved, start: weekdaySpan.start, end: weekdaySpan.end };
    }
  }

  const todaySpan = findFirst(text, /\btoday\b/iu);

  if (todaySpan) {
    return { value: startOfDay(now), start: todaySpan.start, end: todaySpan.end };
  }

  const tomorrowSpan = findFirst(text, /\btomorrow\b/iu);

  if (tomorrowSpan) {
    return { value: startOfDay(addDays(now, 1)), start: tomorrowSpan.start, end: tomorrowSpan.end };
  }

  return null;
}
```

Add the masking helper next to `collapseWhitespace`:

```ts
// Every sigil token is blanked before dates are scanned, matched or not, and is
// replaced by spaces of the same length so indices still line up with the
// original input. Cutting only the *matched* sigils is not enough: `#Monday` is
// not a category, so it survives into the date scan, and `\b` matches between
// `#` and `M` — the weekday matcher would read a due date out of it.
function maskSigils(text: string): string {
  return text.replace(/[#!]\w+/gu, (token) => ' '.repeat(token.length));
}
```

Then replace the body of `parseQuickAdd` with:

```ts
export function parseQuickAdd(input: string, now = new Date()): QuickAddParseResult {
  const categoryMatch = matchSigil(input, '#', TASK_CATEGORY_VALUES);
  const priorityMatch = matchSigil(input, '!', TASK_PRIORITY_VALUES);

  const dateMatch = matchDate(maskSigils(input), now);

  return {
    title: collapseWhitespace(cutSpans(input, [categoryMatch, priorityMatch, dateMatch])),
    dueDate: dateMatch ? format(dateMatch.value, 'yyyy-MM-dd') : undefined,
    category: categoryMatch?.value,
    priority: priorityMatch?.value,
  };
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `pnpm --filter @just-do-it/app exec vitest run src/features/tasks/quick-add-parser.test.ts`

Expected: PASS — 40 tests (the 16 from Step 1 plus the 24 added in Step 6).

- [ ] **Step 10: Run the full gate**

```sh
pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: all green; the total test count is 172.

- [ ] **Step 11: Commit**

```bash
git add apps/just-do-it/src/features/tasks/quick-add-parser.ts \
        apps/just-do-it/src/features/tasks/quick-add-parser.test.ts
git commit -m "feat(tasks): add the quick-add natural-language parser"
```

---

### Task 2: Mutation-check the parser suite

Characterization tests written against working code pass on their first run, which proves nothing about whether they can fail. This task proves it. It is separate because a reviewer could reasonably accept Task 2's implementation while rejecting its tests as tautological.

**Files:**

- Modify: `apps/just-do-it/src/features/tasks/quick-add-parser.test.ts` (only if a mutation survives)

**Interfaces:**

- Consumes: the parser and its suite from Task 1.
- Produces: no new API. Output is a confirmed-sensitive test suite.

- [ ] **Step 1: Back up the parser**

```bash
cp apps/just-do-it/src/features/tasks/quick-add-parser.ts /tmp/quick-add-parser.backup.ts
```

- [ ] **Step 2: Apply each mutation, run the suite, restore**

For each mutation below: make the edit, run
`pnpm --filter @just-do-it/app exec vitest run src/features/tasks/quick-add-parser.test.ts`,
record whether it FAILED (good — the tests caught it) or PASSED (bad — a gap),
then restore with
`cp /tmp/quick-add-parser.backup.ts apps/just-do-it/src/features/tasks/quick-add-parser.ts`.

| #   | Mutation                                                                                     | Expected to be caught by                                 |
| --- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | Move the bare-weekday block above the `next <weekday>` block                                 | "strips the whole 'next <weekday>' phrase"               |
| 2   | Replace the combined `ANY_WEEKDAY` match with a loop over `WEEKDAYS` returning the first hit | "uses the leftmost weekday when two appear"              |
| 3   | Drop the `\b` anchors from the `today` pattern                                               | "does not match a date word inside a longer word"        |
| 4   | Delete the `addYears` roll-forward, returning `atStartOfDay` always                          | "rolls a past month-day forward to next year"            |
| 5   | Change `nextDay` to return the same day when it already matches                              | "resolves a weekday that is today to the following week" |
| 6   | Make `matchSigil` return the first sigil found regardless of the values list                 | "leaves an unknown category in the title"                |
| 7   | Pass `input` instead of `maskSigils(input)` to `matchDate`                                   | "does not read a date out of the category sigil"         |
| 8   | Reverse the sort in `cutSpans` to ascending                                                  | "reads a date and both sigils together"                  |
| 9   | Swap `'MMMM d'` for `'MMM d'` in the format list                                             | "reads a full month name"                                |

- [ ] **Step 3: Close any gap**

If any mutation PASSED, the suite has a hole. Write a test that fails under that mutation, following the existing file's style — a literal expectation, the shared `now`, a name stating the behaviour. Re-run that mutation to confirm the new test catches it, then restore.

- [ ] **Step 4: Confirm the parser is back to its committed state**

```bash
git diff --exit-code apps/just-do-it/src/features/tasks/quick-add-parser.ts
```

Expected: no output and exit code 0. If this prints a diff, a mutation was left in place — restore from the backup before continuing.

- [ ] **Step 5: Run the full gate**

```sh
pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: all green.

- [ ] **Step 6: Commit only if tests were added**

If Step 3 added tests:

```bash
git add apps/just-do-it/src/features/tasks/quick-add-parser.test.ts
git commit -m "test(tasks): close quick-add parser coverage gaps found by mutation"
```

If no mutation survived, there is nothing to commit. Say so and move on.

---

### Task 3: The QuickAddField component, wired into Today

**Files:**

- Create: `apps/just-do-it/src/features/tasks/components/quick-add-field.tsx`
- Modify: `apps/just-do-it/src/features/tasks/index.ts`
- Modify: `apps/just-do-it/src/routes/today-page.tsx`

**Interfaces:**

- Consumes: `parseQuickAdd`, `QuickAddParseResult` (Task 1); `defaultTaskEditorValues`, `toTaskInput` from `./task-data`; `useCreateTask` from `./hooks`; `Button`, `Card`, `Input`, `cn` from `@just-do-it/ui`.
- Produces: `QuickAddField`, a props-free component (`export function QuickAddField(): JSX.Element`). Task 4 renders the same component with no props.

- [ ] **Step 1: Create the component**

There is no component test in this phase — jsdom is not configured (`vitest.config.ts` sets `environment: 'node'`), and wiring it belongs to the testing phase. Verification for this task is the type checker, the build, and the manual check in Step 4.

Create `apps/just-do-it/src/features/tasks/components/quick-add-field.tsx`:

```tsx
import { format, parseISO } from 'date-fns';
import { CalendarClock, Flag, Plus, Tag } from 'lucide-react';
import { useState } from 'react';

import { Button, Input, cn } from '@just-do-it/ui';
import { defaultTaskEditorValues, toTaskInput } from '../task-data';
import { useCreateTask } from '../hooks';
import { parseQuickAdd } from '../quick-add-parser';

const chipClassName =
  'inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium';

export function QuickAddField() {
  const createTask = useCreateTask();
  const [draft, setDraft] = useState('');

  const parsed = parseQuickAdd(draft);
  const hasTitle = parsed.title.length > 0;

  function submit() {
    if (!hasTitle) return;

    createTask(
      toTaskInput({
        ...defaultTaskEditorValues,
        title: parsed.title,
        dueDate: parsed.dueDate ?? '',
        category: parsed.category ?? defaultTaskEditorValues.category,
        priority: parsed.priority ?? defaultTaskEditorValues.priority,
      }),
    );

    setDraft('');
  }

  return (
    <div>
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label className="sr-only" htmlFor="quick-add-field">
          Quick add task
        </label>
        <Input
          aria-describedby="quick-add-field-preview"
          className="flex-1"
          id="quick-add-field"
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Read 20 pages Friday #Reading !high"
          value={draft}
        />
        <Button aria-label="Add task" disabled={!hasTitle} type="submit">
          <Plus aria-hidden="true" className="mr-2 size-4" />
          Add task
        </Button>
      </form>

      <div aria-live="polite" className="mt-3 text-sm" id="quick-add-field-preview">
        {draft.trim().length === 0 ? (
          <p className="text-[var(--muted-foreground)]">
            Add a day, <code>#category</code> or <code>!priority</code> and they will be read out of
            the text.
          </p>
        ) : hasTitle ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{parsed.title}</span>
            <span
              className={cn(
                chipClassName,
                parsed.dueDate
                  ? 'border-[var(--warning)] text-[var(--warning)]'
                  : 'text-[var(--muted-foreground)]',
              )}
            >
              <CalendarClock aria-hidden="true" className="size-3" />
              {parsed.dueDate ? format(parseISO(parsed.dueDate), 'EEE d MMM') : 'No date'}
            </span>
            <span
              className={cn(chipClassName, !parsed.category && 'text-[var(--muted-foreground)]')}
            >
              <Tag aria-hidden="true" className="size-3" />
              {parsed.category ?? defaultTaskEditorValues.category}
            </span>
            <span
              className={cn(chipClassName, !parsed.priority && 'text-[var(--muted-foreground)]')}
            >
              <Flag aria-hidden="true" className="size-3" />
              {parsed.priority ?? defaultTaskEditorValues.priority}
            </span>
          </div>
        ) : (
          <p className="text-[var(--muted-foreground)]">
            Add a title — that is everything outside the date and the sigils.
          </p>
        )}
      </div>
    </div>
  );
}
```

`parseQuickAdd(draft)` is called without a `now`, so it uses the real clock. That is correct here: this is the app, not a test.

- [ ] **Step 2: Export it from the barrel**

In `apps/just-do-it/src/features/tasks/index.ts`, add to the component export group at the top, keeping it alphabetised:

```ts
export { QuickAddField } from './components/quick-add-field';
```

- [ ] **Step 3: Replace the inline form on Today**

In `apps/just-do-it/src/routes/today-page.tsx`:

1. Add `QuickAddField` to the existing `'../features/tasks'` import, keeping that list alphabetised.
2. Delete the `const [newTask, setNewTask] = useState('');` line and the whole `addTask` function.
3. Replace the `<form>…</form>` block and the `<p id="today-quick-add-help">…</p>` that follows it with a single `<QuickAddField />`.
4. Remove now-unused imports: `Input` from `@just-do-it/ui`, `Plus` from `lucide-react`, `toTaskInput` and `useCreateTask` from `'../features/tasks'`. Leave `useState` if any other state remains on the page, and leave `Sparkles` — the Card heading still uses it.

This cleanup is not optional, but oxlint is not what enforces it: `.oxlintrc.json` enables only
`react/rules-of-hooks` and `react/only-export-components`. `tsconfig.app.json` sets
`noUnusedLocals: true`, so `pnpm typecheck` fails on a leftover import with `TS6133`.

- [ ] **Step 4: Verify the gate and check it by hand**

```sh
pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: all green, test count unchanged at 172 (or higher if Task 3 added tests).

Then `pnpm dev` and open `/today`. Type each of these and confirm the preview before pressing Enter:

| Type this                             | Preview should read                                     |
| ------------------------------------- | ------------------------------------------------------- |
| `Read 20 pages Friday #Reading !high` | title `Read 20 pages`, the coming Friday, Reading, high |
| `Call the dentist`                    | title `Call the dentist`, No date, Personal, medium     |
| `#Reading`                            | the "Add a title" hint, Add task disabled               |
| (empty)                               | the "Add a day, #category…" hint, Add task disabled     |

Press Enter on the first and confirm the created task appears with the right due date and category.

- [ ] **Step 5: Commit**

```bash
git add apps/just-do-it/src/features/tasks/components/quick-add-field.tsx \
        apps/just-do-it/src/features/tasks/index.ts \
        apps/just-do-it/src/routes/today-page.tsx
git commit -m "feat(tasks): add the quick-add field with a live parse preview"
```

---

### Task 4: Quick add on the Tasks page

**Files:**

- Modify: `apps/just-do-it/src/routes/tasks-page.tsx`

**Interfaces:**

- Consumes: `QuickAddField` from `'../features/tasks'` (Task 3). No props.
- Produces: nothing new.

- [ ] **Step 1: Render the component**

In `apps/just-do-it/src/routes/tasks-page.tsx`:

1. Add `QuickAddField` to the existing `'../features/tasks'` import, keeping it alphabetised.
2. Insert a `Card` holding it immediately after the closing `</section>` of the page header (the section containing the `Tasks` heading and the `New task` button) and before the `<div className="mb-6 grid gap-4 md:grid-cols-3">` stats row:

```tsx
<Card className="mb-6">
  <div className="mb-4">
    <h2 className="font-bold">Quick add</h2>
    <p className="text-sm text-[var(--muted-foreground)]">
      Type a day, <code>#category</code> or <code>!priority</code> straight into the title.
    </p>
  </div>
  <QuickAddField />
</Card>
```

`Card` is already imported on this page. Confirm it accepts a `className` prop before using one — if it does not, wrap the `Card` in a `<div className="mb-6">` instead.

- [ ] **Step 2: Verify the gate and check it by hand**

```sh
pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: all green.

Then `pnpm dev`, open `/tasks`, and type `Groceries tomorrow #Errand`. Confirm the preview reads title `Groceries`, tomorrow's date, Errand, medium. Press Enter and confirm the task appears in the list below with that due date, and that the existing full task form still works for editing.

- [ ] **Step 3: Commit**

```bash
git add apps/just-do-it/src/routes/tasks-page.tsx
git commit -m "feat(tasks): put quick add on the tasks page"
```

---

### Task 5: Record the phase progress

**Files:**

- Modify: `just-do-it-implementation-plan.md`
- Modify: `CLAUDE.md`

**Interfaces:**

- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Update the roadmap**

In `just-do-it-implementation-plan.md` §7, under `### Phase 12 — Quick add & command surface (partial)`, tick the three boxes this work completes and leave the rest, adding a line naming what is deferred:

```markdown
- [x] Natural-language parser — `Workout tomorrow`, `Read 20 pages Friday`, `Finish portfolio Aug 20`
- [x] Parse due date via date-fns, infer category from keywords, infer priority from markers
- [x] Show a parsed-result preview before commit, so the guess is correctable
- [ ] Command palette (⌘K) — needs a `command` primitive in `packages/ui`
- [ ] Keyboard shortcuts for new task, search, and navigation
- [ ] Make quick add reachable from every route, not just Today

The parser shipped with explicit sigils for category and priority (`#Reading`, `!high`) rather
than keyword inference — "Buy a book about workout nutrition" matches two categories and any
tie-break is a guess. Quick add is on Today and Tasks; the remaining three boxes are the command
palette half of this phase, deferred to its own spec. Recurrence parsing (`every Monday`) was
also considered and deferred. See
`docs/superpowers/specs/2026-08-27-quick-add-parser-design.md`.
```

Also update the status line at the top of the file (line 4) if it still describes Phase 12 as untouched.

- [ ] **Step 2: Update the architecture notes**

In `CLAUDE.md`, the bullet beginning "`features/tasks` and `features/habits` are the only domains with a `components/` subdirectory" is still true and needs no change. Instead, add a sentence to the data-flow section noting the parser, since it is the first pure logic in the repo that is neither a selector nor a store:

```markdown
`features/tasks/quick-add-parser.ts` is a pure text→data function (`parseQuickAdd(input, now)`),
sitting beside the selectors rather than in the fixture pipeline. It takes an injectable `now`
for the same reason selectors do, and applies no defaults — absent fields mean "not specified",
and the calling route supplies `todo`/`medium`/`Personal`.
```

- [ ] **Step 3: Verify and commit**

```sh
pnpm format && pnpm format:check
```

```bash
git add just-do-it-implementation-plan.md CLAUDE.md
git commit -m "docs: record the quick-add parser and what phase 12 still owes"
```

---

## Final verification

- [ ] `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build` — all green from the repo root.
- [ ] Every mutation in Task 3 is caught by at least one test.
- [ ] Every worked example in the spec's grammar table produces the tabulated result, checked by hand in `pnpm dev` on both `/today` and `/tasks`.
- [ ] `git log --oneline main..HEAD` shows four or five commits, each one a complete, green change.
- [ ] Push and open a PR against `main`. Branch protection requires the **Verify** check.

## Known limitations to state in the PR

- **`may` is both a month and a common word.** `Read the may 20 report` parses `may 20` as 20 May. Rare in practice, and the live preview makes it visible before commit, so it is accepted rather than special-cased.
- **No recurrence, no description.** Deferred by the spec.
- **No component or route test.** jsdom is not configured; the preview is verified by hand.
