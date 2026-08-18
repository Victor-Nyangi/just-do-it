# Habits Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the positional `days: boolean[5]` habit model with dated `HabitCompletion` records, unlocking streaks, frequency, targets, real history, and a working `/habits` route.

**Architecture:** Two collections in one Zustand store (`habits`, `completions`), mirroring the two planned backend tables. All history logic lives in pure selectors over `readonly` arrays with an injectable `now`. Zod re-parses on every mutation, and the completion list schema enforces `(habitId, date)` uniqueness. Consumers (Today strip, calendar activity map) derive from real dates instead of array positions.

**Tech Stack:** TypeScript 6, React 19, Zustand 5, Zod 4, date-fns 4, Vite 8, Tailwind v4 (CSS-configured), vitest (added by this plan), pnpm 10 + Turborepo.

**Spec:** `docs/superpowers/specs/2026-08-17-habits-domain-design.md`

## Global Constraints

Copied from the spec and from `CLAUDE.md`. Every task's requirements implicitly include this section.

- **Run every command from the repo root** (`indie-mono-repo/`), never from `apps/just-do-it/`. This is a real pnpm + Turborepo monorepo.
- **`pnpm build` is the real typecheck.** `pnpm typecheck` was fixed in `chore/typecheck-script` to `tsc -b --noEmit --force`; both work now, but `pnpm build` remains the authoritative gate.
- **No test runner existed before this plan.** Task 1 adds vitest. Only selectors, schemas, and the store get tests — routes and components do not. Never describe a UI change as tested.
- **Prettier style is uniform and must stay so:** semicolons, single quotes, trailing commas, 100 columns. Run `pnpm format` before every commit; `pnpm format:check` must pass.
- **Variable names are spelled out.** No single-letter or abbreviated identifiers — `completion`, not `c`; `existingHabit`, not `h`.
- **Icons from `lucide-react`, dates from `date-fns`** (`parseISO`, `startOfDay`, `startOfWeek`, `subDays`, `format` — no hand-rolled date math), IDs from `crypto.randomUUID()`.
- **Theming is CSS custom properties**, never hex or Tailwind palette classes: `bg-[var(--primary)]`, `text-[var(--muted-foreground)]`. Green = primary/success, purple = accent action, yellow = warning/time-sensitive only. A broken streak is muted, not yellow.
- **Feature file-name convention is fixed:** `habit-data.ts`, `habit-store.ts`, `habit-selectors.ts`, `hooks.ts`, `types.ts`, `index.ts`.
- **`index.ts` is an explicit named-export barrel — no `export *`.** Routes import from `'../features/habits'`, never a deeper path.
- **Features must not import each other's internals.** Duplicate a small helper rather than reaching into another feature.
- **Fixtures are POC-only:** no real user data or secrets in `src/data/*.json`.
- **Conventional Commits scoped by domain**, e.g. `feat(habits):`, `refactor(today,calendar):`.
- **Branch:** `feat/habits-domain` (already created, already holds the spec commit).

## Deviations from the spec

Two, both deliberate. Flagging rather than silently absorbing them.

1. **No breaking commit window.** The spec's §Work breakdown accepted that commits 2 and 4 would leave the app un-typecheckable in between. This plan avoids that entirely: Task 2 **adds** the new fields and the completions collection while leaving `days` and `HABIT_DAY_COUNT` in place; Task 4 **deletes** them only after Task 3 has moved every consumer off them. Every task ends on a green `pnpm build`.
2. **The store and the schemas get tests, not just the selectors.** The spec said selectors only. But `(habitId, date)` uniqueness is the model's load-bearing invariant and it lives half in Zod and half in `toggleHabitCompletionOn` — it is exactly the thing worth pinning. This adds roughly 40 lines of test. Routes and components remain untested, as specified.
3. **`addHabit` returns the new id** (`(input: HabitInput) => string`) where the spec wrote `=> void`. This matches `createList` in the lists store, and the detail route needs the id to navigate after creation.

## Date basis

**Today is 2026-08-18, a Tuesday.** The spec was written on 2026-08-17 and pinned the fixture window to end that Monday; this plan extends it one day so "today" stays real. The fixture window is **2026-05-25 (Monday) through 2026-08-18 (Tuesday)** — twelve whole weeks plus two days of the current week.

As the spec records, these are absolute dates like every other fixture in this repo, so they go stale. Streaks make stale data read as a bug rather than as old data. Accepted, recorded in plan §6, not solved here.

## File structure

**Created:**

| Path                                                                | Responsibility                           |
| ------------------------------------------------------------------- | ---------------------------------------- |
| `apps/just-do-it/vitest.config.ts`                                  | vitest config for the app package        |
| `apps/just-do-it/src/data/habit-completions.json`                   | the completion log fixture               |
| `apps/just-do-it/src/features/habits/habit-selectors.test.ts`       | streak / rate / progress tests           |
| `apps/just-do-it/src/features/habits/habit-data.test.ts`            | Zod invariant tests                      |
| `apps/just-do-it/src/features/habits/habit-store.test.ts`           | toggle idempotency + cascade delete      |
| `apps/just-do-it/src/features/habits/components/habit-day-grid.tsx` | a row of day cells, used in three places |
| `apps/just-do-it/src/features/lists/list-selectors.test.ts`         | proves the vitest wiring end to end      |
| `apps/just-do-it/src/routes/habits-page.tsx`                        | `/habits`                                |
| `apps/just-do-it/src/routes/habit-detail-page.tsx`                  | `/habits/:habitId`                       |

**Modified:**

| Path                                                     | Change                                                  |
| -------------------------------------------------------- | ------------------------------------------------------- |
| `apps/just-do-it/package.json`                           | vitest devDep, `test` script                            |
| `turbo.json`                                             | `test` task                                             |
| `apps/just-do-it/src/data/habits.json`                   | new habit fields; `days` removed in Task 4              |
| `apps/just-do-it/src/features/habits/types.ts`           | `HabitFrequency`, new `Habit` fields, `HabitCompletion` |
| `apps/just-do-it/src/features/habits/habit-data.ts`      | schemas, refinements, second fixture                    |
| `apps/just-do-it/src/features/habits/habit-selectors.ts` | full rewrite                                            |
| `apps/just-do-it/src/features/habits/habit-store.ts`     | full rewrite                                            |
| `apps/just-do-it/src/features/habits/hooks.ts`           | new hooks                                               |
| `apps/just-do-it/src/features/habits/index.ts`           | barrel                                                  |
| `apps/just-do-it/src/routes/today-page.tsx`              | strip reads real dates                                  |
| `apps/just-do-it/src/routes/calendar-page.tsx`           | `createHabitActivityMap` deleted                        |
| `apps/just-do-it/src/data/dashboard.ts`                  | export the completion fixture                           |
| `apps/just-do-it/src/App.tsx`                            | two habit routes                                        |
| `just-do-it-implementation-plan.md`                      | Phase 13 checked off, §6 updated                        |

---

### Task 1: Wire vitest into the app

Infrastructure only, but it gets its own gate because a reviewer could reject the runner config while approving every selector built on it. The deliverable is a passing test of an **existing** pure selector — that proves the wiring against this repo's real module setup (TS path resolution, `resolveJsonModule`, the fixture parse that runs at import) rather than against a throwaway `expect(1).toBe(1)`.

**Files:**

- Create: `apps/just-do-it/vitest.config.ts`
- Create: `apps/just-do-it/src/features/lists/list-selectors.test.ts`
- Modify: `apps/just-do-it/package.json`
- Modify: `turbo.json`

**Interfaces:**

- Consumes: nothing.
- Produces: a `pnpm test` script at the root that runs `turbo test`, and a per-package `test` script running `vitest run`. Every later task's test step calls `pnpm test`.

- [ ] **Step 1: Add vitest as a dev dependency**

```bash
pnpm --filter @just-do-it/app add -D vitest@^4.0.0
```

If that exact major is unavailable, take the current latest `4.x` — do not fall back to a v3 line.

- [ ] **Step 2: Create the vitest config**

Create `apps/just-do-it/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

`environment: 'node'` is deliberate — nothing tested here touches the DOM, and jsdom would be an unused dependency. `globals` is left off; test files import `describe`/`it`/`expect` explicitly, which keeps `tsconfig.app.json`'s `types` array untouched.

Note this config does **not** register `@vitejs/plugin-react` or `@tailwindcss/vite`. It does not need them: only `.ts` files are tested, never `.tsx`.

- [ ] **Step 3: Add the test scripts**

In `apps/just-do-it/package.json`, add to `scripts`:

```json
"test": "vitest run"
```

In the root `package.json`, add to `scripts`:

```json
"test": "turbo test"
```

In `turbo.json`, add to `tasks`:

```json
"test": {
  "dependsOn": ["^test"],
  "outputs": []
}
```

`packages/ui` has no `test` script; turbo skips packages that don't define the task, so no change is needed there.

- [ ] **Step 4: Write the test**

Create `apps/just-do-it/src/features/lists/list-selectors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { getInitialLists } from './list-data';
import { selectListById } from './list-selectors';

describe('selectListById', () => {
  it('returns the list with the matching id', () => {
    const lists = getInitialLists();
    const targetList = lists[0];

    expect(selectListById(lists, targetList.id)).toEqual(targetList);
  });

  it('returns null when no list matches', () => {
    expect(selectListById(getInitialLists(), 'no-such-list')).toBeNull();
  });

  it('returns null for an empty collection', () => {
    expect(selectListById([], 'anything')).toBeNull();
  });
});
```

`getInitialLists()` reads and Zod-parses `src/data/lists.json` at import, so a green run here also proves JSON imports resolve under vitest.

- [ ] **Step 5: Run the tests**

Run: `pnpm test`
Expected: PASS, 3 tests. If JSON import resolution fails, the config is missing `resolveJsonModule` behaviour — vitest inherits it from esbuild and should work; do not add a JSON plugin without first reading the actual error.

- [ ] **Step 6: Verify the rest of the toolchain still passes**

Run: `pnpm build && pnpm lint && pnpm format:check`
Expected: all pass. If oxlint flags the new test file, fix the lint rather than excluding the file.

- [ ] **Step 7: Commit**

```bash
pnpm format
git add apps/just-do-it/package.json apps/just-do-it/vitest.config.ts \
        apps/just-do-it/src/features/lists/list-selectors.test.ts \
        package.json turbo.json pnpm-lock.yaml
git commit -m "chore(app): add vitest and a first selector test"
```

---

### Task 2: Add the dated completion model alongside the old one

Adds `HabitCompletion`, the new `Habit` fields, both fixtures, the schemas, and the selectors. **Leaves `days` and `HABIT_DAY_COUNT` in place** so `today-page.tsx` and `calendar-page.tsx` keep compiling — they are moved in Task 3 and the old model is deleted in Task 4.

**Files:**

- Modify: `apps/just-do-it/src/features/habits/types.ts`
- Modify: `apps/just-do-it/src/features/habits/habit-data.ts`
- Modify: `apps/just-do-it/src/features/habits/habit-selectors.ts`
- Modify: `apps/just-do-it/src/features/habits/index.ts`
- Modify: `apps/just-do-it/src/data/habits.json`
- Create: `apps/just-do-it/src/data/habit-completions.json`
- Create: `apps/just-do-it/src/features/habits/habit-data.test.ts`
- Create: `apps/just-do-it/src/features/habits/habit-selectors.test.ts`

**Interfaces:**

- Consumes: `pnpm test` from Task 1.
- Produces, for Tasks 3–5:
  - `type Habit = { id, label, description?, frequency, target, createdAt }` (still carrying `days` until Task 4)
  - `type HabitCompletion = { id: string; habitId: string; date: string }`
  - `type HabitFrequency = 'daily' | 'weekly'`, `HABIT_FREQUENCY_VALUES`
  - `type HabitInput`, `type HabitUpdateInput`
  - `habitSchema`, `habitCompletionSchema`, `habitCompletionCollectionSchema`
  - `getInitialHabits(): Habit[]`, `getInitialHabitCompletions(): HabitCompletion[]`
  - `validatedHabitFixture`, `validatedHabitCompletionFixture`
  - selectors: `toHabitDateKey(date: Date): string`, `isHabitCompletedOn(completions, habitId, dateKey): boolean`, `selectCompletionDatesForHabit(completions, habitId): Set<string>`, `selectHabitCompletionsByDate(completions): Map<string, string[]>`, `selectCurrentStreak(habit, completions, now?): number`, `selectLongestStreak(habit, completions): number`, `selectCompletionRate(habit, completions, now?, windowDays?): number`, `selectPeriodProgress(habit, completions, now?): { completed: number; target: number }`, `selectRecentCompletionDays(completions, habitId, dayCount, now?): { date: Date; complete: boolean }[]`

- [ ] **Step 1: Extend the types**

Replace `apps/just-do-it/src/features/habits/types.ts` with:

```ts
export const HABIT_DAY_COUNT = 5;

export const HABIT_FREQUENCY_VALUES = ['daily', 'weekly'] as const;

export type HabitFrequency = (typeof HABIT_FREQUENCY_VALUES)[number];

export type Habit = {
  id: string;
  label: string;
  description?: string;
  frequency: HabitFrequency;
  target: number;
  createdAt: string;
  days: boolean[];
};

export type HabitCompletion = {
  id: string;
  habitId: string;
  date: string;
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

`days` and `HABIT_DAY_COUNT` are still here **on purpose**. Task 4 removes them.

- [ ] **Step 2: Write the failing schema tests**

Create `apps/just-do-it/src/features/habits/habit-data.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { habitCompletionCollectionSchema, habitSchema } from './habit-data';

const baseHabit = {
  id: 'reading',
  label: 'Reading',
  frequency: 'weekly' as const,
  target: 4,
  createdAt: '2026-05-25',
  days: [true, true, true, true, true],
};

describe('habitSchema', () => {
  it('accepts a weekly habit with a target above one', () => {
    expect(habitSchema.parse(baseHabit).target).toBe(4);
  });

  it('rejects a daily habit whose target is not one', () => {
    expect(() => habitSchema.parse({ ...baseHabit, frequency: 'daily', target: 3 })).toThrow();
  });

  it('accepts a daily habit with a target of one', () => {
    expect(habitSchema.parse({ ...baseHabit, frequency: 'daily', target: 1 }).frequency).toBe(
      'daily',
    );
  });

  it('rejects a target above seven', () => {
    expect(() => habitSchema.parse({ ...baseHabit, target: 8 })).toThrow();
  });

  it('rejects a target below one', () => {
    expect(() => habitSchema.parse({ ...baseHabit, target: 0 })).toThrow();
  });

  it('rejects a malformed createdAt', () => {
    expect(() => habitSchema.parse({ ...baseHabit, createdAt: '25-05-2026' })).toThrow();
  });

  it('normalizes a blank description to undefined', () => {
    expect(habitSchema.parse({ ...baseHabit, description: '   ' }).description).toBeUndefined();
  });
});

describe('habitCompletionCollectionSchema', () => {
  it('accepts distinct habit and date pairs', () => {
    const completions = [
      { id: 'one', habitId: 'reading', date: '2026-08-17' },
      { id: 'two', habitId: 'reading', date: '2026-08-18' },
      { id: 'three', habitId: 'workout', date: '2026-08-17' },
    ];

    expect(habitCompletionCollectionSchema.parse(completions)).toHaveLength(3);
  });

  it('rejects a duplicate habit and date pair', () => {
    const completions = [
      { id: 'one', habitId: 'reading', date: '2026-08-17' },
      { id: 'two', habitId: 'reading', date: '2026-08-17' },
    ];

    expect(() => habitCompletionCollectionSchema.parse(completions)).toThrow();
  });

  it('rejects a malformed date', () => {
    expect(() =>
      habitCompletionCollectionSchema.parse([{ id: 'one', habitId: 'reading', date: 'yesterday' }]),
    ).toThrow();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — `habitCompletionCollectionSchema` is not exported from `./habit-data`.

- [ ] **Step 4: Implement the schemas**

Replace `apps/just-do-it/src/features/habits/habit-data.ts` with:

```ts
import { z } from 'zod';

import habitCompletionsFixture from '../../data/habit-completions.json';
import habitsFixture from '../../data/habits.json';
import { HABIT_DAY_COUNT, HABIT_FREQUENCY_VALUES, type Habit, type HabitCompletion } from './types';

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : undefined;
}

const habitDaysSchema = z.array(z.boolean()).length(HABIT_DAY_COUNT);

const habitDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a calendar date in YYYY-MM-DD form');

export const habitSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().trim().min(1),
    description: z.preprocess(normalizeOptionalText, z.string().optional()),
    frequency: z.enum(HABIT_FREQUENCY_VALUES),
    target: z.number().int().min(1).max(7),
    createdAt: habitDateSchema,
    days: habitDaysSchema,
  })
  .refine((habit) => habit.frequency !== 'daily' || habit.target === 1, {
    message: 'A daily habit must have a target of 1',
    path: ['target'],
  });

export const habitListSchema = z.array(habitSchema);

export const habitCompletionSchema = z.object({
  id: z.string().min(1),
  habitId: z.string().min(1),
  date: habitDateSchema,
});

export const habitCompletionCollectionSchema = z
  .array(habitCompletionSchema)
  .superRefine((completions, context) => {
    const seenKeys = new Set<string>();

    completions.forEach((completion, index) => {
      const completionKey = `${completion.habitId}|${completion.date}`;

      if (seenKeys.has(completionKey)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate completion for ${completionKey}`,
          path: [index],
        });
        return;
      }

      seenKeys.add(completionKey);
    });
  });

const validatedHabitFixture = habitListSchema.parse(habitsFixture);
const validatedHabitCompletionFixture =
  habitCompletionCollectionSchema.parse(habitCompletionsFixture);

export function cloneHabit(habit: Habit): Habit {
  return {
    ...habit,
    days: [...habit.days],
  };
}

export function cloneHabitCompletion(completion: HabitCompletion): HabitCompletion {
  return { ...completion };
}

export function getInitialHabits(): Habit[] {
  return validatedHabitFixture.map(cloneHabit);
}

export function getInitialHabitCompletions(): HabitCompletion[] {
  return validatedHabitCompletionFixture.map(cloneHabitCompletion);
}

export { validatedHabitCompletionFixture, validatedHabitFixture };
```

Note `normalizeOptionalText` is duplicated from `features/lists/list-data.ts` rather than imported — features must not reach into each other, and `packages/utils` is deliberately not built yet.

- [ ] **Step 5: Generate the fixtures**

Write this generator to the scratchpad — **not** into the repo — run it, and delete it. The fixture data it emits is what gets committed.

Create `/tmp/generate-habit-fixtures.mjs`:

```js
import { writeFileSync } from 'node:fs';

const OUTPUT_DIR = 'apps/just-do-it/src/data';

// Inclusive [start, end] runs of completed days, per habit.
const habitRuns = {
  reading: [
    ['2026-05-26', '2026-05-30'],
    ['2026-06-01', '2026-06-06'],
    ['2026-06-08', '2026-06-12'],
    ['2026-06-15', '2026-06-28'], // longest daily run: 14
    ['2026-06-30', '2026-07-05'],
    ['2026-07-07', '2026-07-14'],
    ['2026-07-16', '2026-07-22'],
    ['2026-07-24', '2026-08-01'],
    ['2026-08-03', '2026-08-08'],
    ['2026-08-10', '2026-08-18'], // current run: 9, after a miss on 08-09
  ],
  meditation: [
    ['2026-05-25', '2026-05-29'],
    ['2026-06-02', '2026-06-09'],
    ['2026-06-12', '2026-06-18'],
    ['2026-06-21', '2026-06-25'],
    ['2026-07-06', '2026-07-16'], // longest daily run: 11
    ['2026-07-19', '2026-07-26'],
    ['2026-07-29', '2026-08-05'],
    ['2026-08-08', '2026-08-15'],
    ['2026-08-17', '2026-08-18'], // current run: 2, after a miss on 08-16
  ],
};

// Explicit day lists for the weekly habits, chosen to hit the intended
// per-week counts. Weeks are Monday-first.
const habitDays = {
  workout: [
    '2026-05-26',
    '2026-05-28',
    '2026-05-30', // week of 05-25: 3
    '2026-06-01',
    '2026-06-03',
    '2026-06-05',
    '2026-06-06', // 06-01: 4
    '2026-06-09',
    '2026-06-11', // 06-08: 2
    '2026-06-15',
    '2026-06-17',
    '2026-06-19',
    '2026-06-20', // 06-15: 4
    '2026-06-22',
    '2026-06-23',
    '2026-06-25',
    '2026-06-26',
    '2026-06-27', // 06-22: 5
    '2026-06-30',
    '2026-07-02',
    '2026-07-04', // 06-29: 3 (breaks)
    '2026-07-06',
    '2026-07-08',
    '2026-07-10',
    '2026-07-11', // 07-06: 4
    '2026-07-13',
    '2026-07-14',
    '2026-07-16',
    '2026-07-17',
    '2026-07-18', // 07-13: 5
    '2026-07-20',
    '2026-07-22',
    '2026-07-24',
    '2026-07-25', // 07-20: 4
    '2026-07-27',
    '2026-07-29',
    '2026-07-31',
    '2026-08-01', // 07-27: 4
    '2026-08-03',
    '2026-08-04',
    '2026-08-06',
    '2026-08-07',
    '2026-08-08', // 08-03: 5
    '2026-08-10',
    '2026-08-12',
    '2026-08-14',
    '2026-08-15', // 08-10: 4
    '2026-08-17', // 08-17: 1 (in progress)
  ],
  'language-practice': [
    '2026-05-27', // 05-25: 1
    '2026-06-02',
    '2026-06-04', // 06-01: 2
    '2026-06-08',
    '2026-06-10',
    '2026-06-12', // 06-08: 3
    '2026-06-16',
    '2026-06-18',
    '2026-06-19', // 06-15: 3
    '2026-06-22',
    '2026-06-24',
    '2026-06-25',
    '2026-06-26', // 06-22: 4
    '2026-06-29',
    '2026-07-01',
    '2026-07-03', // 06-29: 3
    '2026-07-07',
    '2026-07-09',
    '2026-07-10', // 07-06: 3 -> longest 5
    '2026-07-15', // 07-13: 1 (breaks)
    '2026-07-21',
    '2026-07-23',
    '2026-07-24', // 07-20: 3
    '2026-07-28',
    '2026-07-30', // 07-27: 2
    '2026-08-04',
    '2026-08-06',
    '2026-08-07', // 08-03: 3
    '2026-08-11',
    '2026-08-13', // 08-10: 2 (missed)
    '2026-08-18', // 08-17: 1 (in progress)
  ],
};

const habits = [
  {
    id: 'reading',
    label: 'Reading',
    description: 'Twenty pages before bed, every day.',
    frequency: 'daily',
    target: 1,
    createdAt: '2026-05-25',
    days: [true, true, true, true, true],
  },
  {
    id: 'meditation',
    label: 'Meditation',
    description: 'Ten quiet minutes before the day starts.',
    frequency: 'daily',
    target: 1,
    createdAt: '2026-05-25',
    days: [true, true, false, true, false],
  },
  {
    id: 'workout',
    label: 'Workout',
    description: 'Four sessions a week, whichever days fit.',
    frequency: 'weekly',
    target: 4,
    createdAt: '2026-05-25',
    days: [true, true, true, false, true],
  },
  {
    id: 'language-practice',
    label: 'Language practice',
    description: 'Three focused sessions a week.',
    frequency: 'weekly',
    target: 3,
    createdAt: '2026-05-25',
    days: [true, false, true, false, false],
  },
];

function expandRun(startDate, endDate) {
  const dates = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

const completions = [];

for (const [habitId, runs] of Object.entries(habitRuns)) {
  for (const [startDate, endDate] of runs) {
    for (const date of expandRun(startDate, endDate)) {
      completions.push({ id: `${habitId}-${date}`, habitId, date });
    }
  }
}

for (const [habitId, dates] of Object.entries(habitDays)) {
  for (const date of dates) {
    completions.push({ id: `${habitId}-${date}`, habitId, date });
  }
}

completions.sort((leftCompletion, rightCompletion) => {
  if (leftCompletion.date !== rightCompletion.date) {
    return leftCompletion.date < rightCompletion.date ? -1 : 1;
  }
  return leftCompletion.habitId < rightCompletion.habitId ? -1 : 1;
});

writeFileSync(`${OUTPUT_DIR}/habits.json`, `${JSON.stringify(habits, null, 2)}\n`);
writeFileSync(`${OUTPUT_DIR}/habit-completions.json`, `${JSON.stringify(completions, null, 2)}\n`);

console.log(`${habits.length} habits, ${completions.length} completions`);
```

Run from the repo root:

```bash
node /tmp/generate-habit-fixtures.mjs && rm /tmp/generate-habit-fixtures.mjs
```

The `days` arrays in the generated habits are throwaway — they exist only to satisfy the still-present `habitDaysSchema` and are deleted in Task 4.

- [ ] **Step 6: Write the failing selector tests**

Create `apps/just-do-it/src/features/habits/habit-selectors.test.ts`. Note these use hand-written completions with a fixed `now`, **not** the fixture — a fixture is demo data, not a test oracle.

```ts
import { describe, expect, it } from 'vitest';

import {
  isHabitCompletedOn,
  selectCompletionRate,
  selectCurrentStreak,
  selectHabitCompletionsByDate,
  selectLongestStreak,
  selectPeriodProgress,
  selectRecentCompletionDays,
  toHabitDateKey,
} from './habit-selectors';
import type { Habit, HabitCompletion } from './types';

const now = new Date(2026, 7, 18); // Tuesday 2026-08-18, local time

const dailyHabit: Habit = {
  id: 'reading',
  label: 'Reading',
  frequency: 'daily',
  target: 1,
  createdAt: '2026-01-01',
  days: [],
};

const weeklyHabit: Habit = {
  id: 'workout',
  label: 'Workout',
  frequency: 'weekly',
  target: 4,
  createdAt: '2026-01-01',
  days: [],
};

function completionsOn(habitId: string, dates: readonly string[]): HabitCompletion[] {
  return dates.map((date) => ({ id: `${habitId}-${date}`, habitId, date }));
}

describe('toHabitDateKey', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(toHabitDateKey(now)).toBe('2026-08-18');
  });
});

describe('isHabitCompletedOn', () => {
  const completions = completionsOn('reading', ['2026-08-17']);

  it('is true for a recorded day', () => {
    expect(isHabitCompletedOn(completions, 'reading', '2026-08-17')).toBe(true);
  });

  it('is false for an unrecorded day', () => {
    expect(isHabitCompletedOn(completions, 'reading', '2026-08-18')).toBe(false);
  });

  it('is false for another habit on a recorded day', () => {
    expect(isHabitCompletedOn(completions, 'workout', '2026-08-17')).toBe(false);
  });
});

describe('selectHabitCompletionsByDate', () => {
  it('groups habit ids under each date', () => {
    const completions = [
      ...completionsOn('reading', ['2026-08-17', '2026-08-18']),
      ...completionsOn('workout', ['2026-08-17']),
    ];

    const byDate = selectHabitCompletionsByDate(completions);

    expect(byDate.get('2026-08-17')).toEqual(['reading', 'workout']);
    expect(byDate.get('2026-08-18')).toEqual(['reading']);
    expect(byDate.has('2026-08-16')).toBe(false);
  });

  it('returns an empty map for no completions', () => {
    expect(selectHabitCompletionsByDate([]).size).toBe(0);
  });
});

describe('selectCurrentStreak — daily', () => {
  it('counts an unbroken run ending today', () => {
    const completions = completionsOn('reading', ['2026-08-16', '2026-08-17', '2026-08-18']);

    expect(selectCurrentStreak(dailyHabit, completions, now)).toBe(3);
  });

  it('applies grace when today is not yet complete', () => {
    const completions = completionsOn('reading', ['2026-08-15', '2026-08-16', '2026-08-17']);

    expect(selectCurrentStreak(dailyHabit, completions, now)).toBe(3);
  });

  it('is zero when both today and yesterday are missed', () => {
    const completions = completionsOn('reading', ['2026-08-14', '2026-08-15', '2026-08-16']);

    expect(selectCurrentStreak(dailyHabit, completions, now)).toBe(0);
  });

  it('counts a single completed day', () => {
    expect(selectCurrentStreak(dailyHabit, completionsOn('reading', ['2026-08-18']), now)).toBe(1);
  });

  it('is zero with no completions', () => {
    expect(selectCurrentStreak(dailyHabit, [], now)).toBe(0);
  });

  it('ignores completions belonging to another habit', () => {
    expect(selectCurrentStreak(dailyHabit, completionsOn('workout', ['2026-08-18']), now)).toBe(0);
  });
});

describe('selectCurrentStreak — weekly', () => {
  // Monday-first weeks. 2026-08-17 is a Monday, so the current week is 08-17..08-23.
  it('counts consecutive weeks that reach target, with the current week in progress', () => {
    const completions = completionsOn('workout', [
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06', // week of 08-03: 4
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13', // week of 08-10: 4
      '2026-08-17', // current week: 1, below target
    ]);

    expect(selectCurrentStreak(weeklyHabit, completions, now)).toBe(2);
  });

  it('counts the current week once it reaches target', () => {
    const completions = completionsOn('workout', [
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
    ]);

    expect(selectCurrentStreak(weeklyHabit, completions, now)).toBe(2);
  });

  it('stops at a week that misses target', () => {
    const completions = completionsOn('workout', [
      '2026-07-27',
      '2026-07-28',
      '2026-07-29',
      '2026-07-30', // week of 07-27: 4
      '2026-08-03',
      '2026-08-04',
      '2026-08-05', // week of 08-03: 3, misses
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13', // week of 08-10: 4
    ]);

    expect(selectCurrentStreak(weeklyHabit, completions, now)).toBe(1);
  });

  it('is zero when the most recent complete week misses target', () => {
    const completions = completionsOn('workout', ['2026-08-10', '2026-08-11']);

    expect(selectCurrentStreak(weeklyHabit, completions, now)).toBe(0);
  });
});

describe('selectLongestStreak', () => {
  it('finds the longest daily run even when it is not the current one', () => {
    const completions = completionsOn('reading', [
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-04',
      '2026-07-05',
      '2026-08-17',
      '2026-08-18',
    ]);

    expect(selectLongestStreak(dailyHabit, completions)).toBe(5);
  });

  it('returns the current run when it is the longest', () => {
    const completions = completionsOn('reading', ['2026-08-16', '2026-08-17', '2026-08-18']);

    expect(selectLongestStreak(dailyHabit, completions)).toBe(3);
  });

  it('applies no grace — an in-progress period is not special', () => {
    const completions = completionsOn('reading', ['2026-08-17']);

    expect(selectLongestStreak(dailyHabit, completions)).toBe(1);
  });

  it('counts consecutive qualifying weeks', () => {
    const completions = completionsOn('workout', [
      '2026-07-27',
      '2026-07-28',
      '2026-07-29',
      '2026-07-30',
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-10',
      '2026-08-11', // below target, breaks the run
    ]);

    expect(selectLongestStreak(weeklyHabit, completions)).toBe(2);
  });

  it('is zero with no completions', () => {
    expect(selectLongestStreak(dailyHabit, [])).toBe(0);
    expect(selectLongestStreak(weeklyHabit, [])).toBe(0);
  });
});

describe('selectCompletionRate', () => {
  it('is one when every day in the window is complete', () => {
    const dates = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(2026, 7, 18 - index);
      return toHabitDateKey(date);
    });

    expect(selectCompletionRate(dailyHabit, completionsOn('reading', dates), now)).toBe(1);
  });

  it('is zero with no completions', () => {
    expect(selectCompletionRate(dailyHabit, [], now)).toBe(0);
  });

  it('clamps the window to createdAt', () => {
    // Created three days ago, complete on all three days -> 1, not 3/30.
    const recentHabit: Habit = { ...dailyHabit, createdAt: '2026-08-16' };
    const completions = completionsOn('reading', ['2026-08-16', '2026-08-17', '2026-08-18']);

    expect(selectCompletionRate(recentHabit, completions, now)).toBe(1);
  });

  it('never exceeds one when a weekly habit overshoots its target', () => {
    const completions = completionsOn('workout', [
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
      '2026-08-17',
      '2026-08-18',
    ]);

    expect(selectCompletionRate(weeklyHabit, completions, now)).toBeLessThanOrEqual(1);
  });

  it('divides by one rather than zero for a habit created today', () => {
    const brandNewHabit: Habit = { ...dailyHabit, createdAt: '2026-08-18' };

    expect(selectCompletionRate(brandNewHabit, [], now)).toBe(0);
    expect(selectCompletionRate(brandNewHabit, completionsOn('reading', ['2026-08-18']), now)).toBe(
      1,
    );
  });
});

describe('selectPeriodProgress', () => {
  it('reports today for a daily habit', () => {
    expect(selectPeriodProgress(dailyHabit, completionsOn('reading', ['2026-08-18']), now)).toEqual(
      {
        completed: 1,
        target: 1,
      },
    );
  });

  it('reports zero for a daily habit not yet done today', () => {
    expect(selectPeriodProgress(dailyHabit, completionsOn('reading', ['2026-08-17']), now)).toEqual(
      {
        completed: 0,
        target: 1,
      },
    );
  });

  it('counts the current week for a weekly habit', () => {
    const completions = completionsOn('workout', ['2026-08-17', '2026-08-18', '2026-08-10']);

    expect(selectPeriodProgress(weeklyHabit, completions, now)).toEqual({
      completed: 2,
      target: 4,
    });
  });
});

describe('selectRecentCompletionDays', () => {
  it('returns the requested number of days ending today, oldest first', () => {
    const completions = completionsOn('reading', ['2026-08-16', '2026-08-18']);
    const recentDays = selectRecentCompletionDays(completions, 'reading', 3, now);

    expect(recentDays).toHaveLength(3);
    expect(recentDays.map((day) => toHabitDateKey(day.date))).toEqual([
      '2026-08-16',
      '2026-08-17',
      '2026-08-18',
    ]);
    expect(recentDays.map((day) => day.complete)).toEqual([true, false, true]);
  });

  it('returns all-incomplete days for an unknown habit', () => {
    const recentDays = selectRecentCompletionDays([], 'no-such-habit', 2, now);

    expect(recentDays.map((day) => day.complete)).toEqual([false, false]);
  });
});
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — none of the new selectors are exported from `./habit-selectors`.

- [ ] **Step 8: Implement the selectors**

Replace `apps/just-do-it/src/features/habits/habit-selectors.ts` with:

```ts
import {
  differenceInCalendarDays,
  format,
  parseISO,
  startOfDay,
  startOfWeek,
  subDays,
  subWeeks,
} from 'date-fns';

import type { Habit, HabitCompletion } from './types';

const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

export function toHabitDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function selectCompletionDatesForHabit(
  completions: readonly HabitCompletion[],
  habitId: string,
): Set<string> {
  const completionDates = new Set<string>();

  for (const completion of completions) {
    if (completion.habitId === habitId) {
      completionDates.add(completion.date);
    }
  }

  return completionDates;
}

export function isHabitCompletedOn(
  completions: readonly HabitCompletion[],
  habitId: string,
  dateKey: string,
): boolean {
  return completions.some(
    (completion) => completion.habitId === habitId && completion.date === dateKey,
  );
}

export function selectHabitCompletionsByDate(
  completions: readonly HabitCompletion[],
): Map<string, string[]> {
  const completionsByDate = new Map<string, string[]>();

  for (const completion of completions) {
    const existingHabitIds = completionsByDate.get(completion.date);

    if (existingHabitIds) {
      existingHabitIds.push(completion.habitId);
      continue;
    }

    completionsByDate.set(completion.date, [completion.habitId]);
  }

  return completionsByDate;
}

function countCompletionsByWeek(completionDates: ReadonlySet<string>): Map<string, number> {
  const countsByWeek = new Map<string, number>();

  for (const dateKey of completionDates) {
    const weekKey = toHabitDateKey(startOfWeek(parseISO(dateKey), WEEK_OPTIONS));
    countsByWeek.set(weekKey, (countsByWeek.get(weekKey) ?? 0) + 1);
  }

  return countsByWeek;
}

function selectDailyStreak(completionDates: ReadonlySet<string>, now: Date): number {
  let cursor = startOfDay(now);

  // A day still in progress must not break a streak.
  if (!completionDates.has(toHabitDateKey(cursor))) {
    cursor = subDays(cursor, 1);
  }

  let streak = 0;

  while (completionDates.has(toHabitDateKey(cursor))) {
    streak += 1;
    cursor = subDays(cursor, 1);
  }

  return streak;
}

function selectWeeklyStreak(
  completionDates: ReadonlySet<string>,
  target: number,
  now: Date,
): number {
  const countsByWeek = countCompletionsByWeek(completionDates);
  const weekQualifies = (weekStart: Date): boolean =>
    (countsByWeek.get(toHabitDateKey(weekStart)) ?? 0) >= target;

  let cursor = startOfWeek(now, WEEK_OPTIONS);

  // A week still in progress must not break a streak.
  if (!weekQualifies(cursor)) {
    cursor = subWeeks(cursor, 1);
  }

  let streak = 0;

  while (weekQualifies(cursor)) {
    streak += 1;
    cursor = subWeeks(cursor, 1);
  }

  return streak;
}

export function selectCurrentStreak(
  habit: Habit,
  completions: readonly HabitCompletion[],
  now: Date = new Date(),
): number {
  const completionDates = selectCompletionDatesForHabit(completions, habit.id);

  return habit.frequency === 'daily'
    ? selectDailyStreak(completionDates, now)
    : selectWeeklyStreak(completionDates, habit.target, now);
}

function selectLongestRun(sortedDateKeys: readonly string[], stepDays: number): number {
  if (sortedDateKeys.length === 0) return 0;

  let longestRun = 1;
  let currentRun = 1;

  for (let index = 1; index < sortedDateKeys.length; index += 1) {
    const previousDate = parseISO(sortedDateKeys[index - 1]);
    const currentDate = parseISO(sortedDateKeys[index]);

    currentRun =
      differenceInCalendarDays(currentDate, previousDate) === stepDays ? currentRun + 1 : 1;

    if (currentRun > longestRun) {
      longestRun = currentRun;
    }
  }

  return longestRun;
}

export function selectLongestStreak(habit: Habit, completions: readonly HabitCompletion[]): number {
  const completionDates = selectCompletionDatesForHabit(completions, habit.id);

  if (habit.frequency === 'daily') {
    return selectLongestRun([...completionDates].sort(), 1);
  }

  const qualifyingWeekKeys = [...countCompletionsByWeek(completionDates).entries()]
    .filter(([, completionCount]) => completionCount >= habit.target)
    .map(([weekKey]) => weekKey)
    .sort();

  return selectLongestRun(qualifyingWeekKeys, 7);
}

export function selectCompletionRate(
  habit: Habit,
  completions: readonly HabitCompletion[],
  now: Date = new Date(),
  windowDays = 30,
): number {
  const completionDates = selectCompletionDatesForHabit(completions, habit.id);
  if (completionDates.size === 0) return 0;

  const today = startOfDay(now);
  const windowStart = subDays(today, windowDays - 1);
  const createdAt = startOfDay(parseISO(habit.createdAt));
  const eligibleStart = createdAt > windowStart ? createdAt : windowStart;
  const eligibleDays = Math.max(1, differenceInCalendarDays(today, eligibleStart) + 1);

  let completedInWindow = 0;

  for (const dateKey of completionDates) {
    const date = startOfDay(parseISO(dateKey));
    if (date >= eligibleStart && date <= today) {
      completedInWindow += 1;
    }
  }

  if (habit.frequency === 'daily') {
    return Math.min(1, completedInWindow / eligibleDays);
  }

  const eligibleWeeks = Math.max(1, Math.ceil(eligibleDays / 7));
  return Math.min(1, completedInWindow / (habit.target * eligibleWeeks));
}

export function selectPeriodProgress(
  habit: Habit,
  completions: readonly HabitCompletion[],
  now: Date = new Date(),
): { completed: number; target: number } {
  const completionDates = selectCompletionDatesForHabit(completions, habit.id);

  if (habit.frequency === 'daily') {
    return {
      completed: completionDates.has(toHabitDateKey(startOfDay(now))) ? 1 : 0,
      target: 1,
    };
  }

  const weekKey = toHabitDateKey(startOfWeek(now, WEEK_OPTIONS));

  return {
    completed: countCompletionsByWeek(completionDates).get(weekKey) ?? 0,
    target: habit.target,
  };
}

export function selectRecentCompletionDays(
  completions: readonly HabitCompletion[],
  habitId: string,
  dayCount: number,
  now: Date = new Date(),
): { date: Date; complete: boolean }[] {
  const completionDates = selectCompletionDatesForHabit(completions, habitId);
  const today = startOfDay(now);

  return Array.from({ length: dayCount }, (_, index) => {
    const date = subDays(today, dayCount - index - 1);
    return { date, complete: completionDates.has(toHabitDateKey(date)) };
  });
}
```

Append one more export to that file — a temporary carry-over of the old selector, kept only so `today-page.tsx` still compiles until Task 3 ports it. Task 4 deletes it:

```ts
// Temporary: still read by today-page.tsx until Task 3. Deleted in Task 4.
export function selectHabitCompletionCount(habit: Habit): number {
  return habit.days.filter(Boolean).length;
}
```

- [ ] **Step 9: Update the barrel**

In `apps/just-do-it/src/features/habits/index.ts`, add the new exports while keeping the existing ones (which Task 3 still needs):

```ts
export {
  cloneHabit,
  cloneHabitCompletion,
  getInitialHabitCompletions,
  getInitialHabits,
  habitCompletionCollectionSchema,
  habitCompletionSchema,
  habitListSchema,
  habitSchema,
  validatedHabitCompletionFixture,
  validatedHabitFixture,
} from './habit-data';
export { useHabits, useSetHabitCompletion, useToggleHabitCompletion } from './hooks';
export {
  isHabitCompletedOn,
  selectCompletionDatesForHabit,
  selectCompletionRate,
  selectCurrentStreak,
  selectHabitCompletionCount,
  selectHabitCompletionsByDate,
  selectLongestStreak,
  selectPeriodProgress,
  selectRecentCompletionDays,
  toHabitDateKey,
} from './habit-selectors';
export { useHabitStore } from './habit-store';
export type { Habit, HabitCompletion, HabitFrequency, HabitInput, HabitUpdateInput } from './types';
export { HABIT_DAY_COUNT, HABIT_FREQUENCY_VALUES } from './types';
```

Note `selectHabitCompletionCount` stays in the export list. `today-page.tsx` still imports it, and it is not removed until Task 4.

- [ ] **Step 10: Run the tests**

Run: `pnpm test`
Expected: PASS. If a weekly streak test fails, check `weekStartsOn: 1` is applied in **both** `countCompletionsByWeek` and `selectWeeklyStreak` — a mismatch there produces off-by-one-week results that look like random failures.

- [ ] **Step 11: Verify the build**

Run: `pnpm build && pnpm lint && pnpm format:check`
Expected: all pass. The app still renders the old positional strip — that is correct at this point.

- [ ] **Step 12: Commit**

```bash
pnpm format
git add apps/just-do-it/src/features/habits apps/just-do-it/src/data
git commit -m "feat(habits): model completions as dated records"
```

---

### Task 3: Move the store and consumers onto real dates

Rewrites the store around the two collections and ports both consumers. After this task nothing reads `habit.days` any more.

**Files:**

- Modify: `apps/just-do-it/src/features/habits/habit-store.ts`
- Modify: `apps/just-do-it/src/features/habits/hooks.ts`
- Modify: `apps/just-do-it/src/features/habits/index.ts`
- Modify: `apps/just-do-it/src/routes/today-page.tsx`
- Modify: `apps/just-do-it/src/routes/calendar-page.tsx`
- Modify: `apps/just-do-it/src/data/dashboard.ts`
- Create: `apps/just-do-it/src/features/habits/habit-store.test.ts`

**Interfaces:**

- Consumes: everything Task 2 produced.
- Produces, for Task 5:
  - store actions `toggleHabitCompletionOn(habitId: string, dateKey: string): void`, `addHabit(input: HabitInput): string`, `updateHabit(habitId: string, input: HabitUpdateInput): void`, `removeHabit(habitId: string): void`
  - hooks `useHabits()`, `useHabitCompletions()`, `useHabitById(habitId: string): Habit | null`, `useToggleHabitCompletion()`, `useAddHabit()`, `useUpdateHabit()`, `useRemoveHabit()`

- [ ] **Step 1: Write the failing store tests**

Create `apps/just-do-it/src/features/habits/habit-store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';

import { getInitialHabitCompletions, getInitialHabits } from './habit-data';
import { useHabitStore } from './habit-store';

describe('useHabitStore', () => {
  beforeEach(() => {
    useHabitStore.setState({
      habits: getInitialHabits(),
      completions: getInitialHabitCompletions(),
    });
  });

  it('adds a completion for a day that has none', () => {
    const { toggleHabitCompletionOn } = useHabitStore.getState();
    toggleHabitCompletionOn('reading', '2026-08-09');

    const { completions } = useHabitStore.getState();
    expect(
      completions.filter(
        (completion) => completion.habitId === 'reading' && completion.date === '2026-08-09',
      ),
    ).toHaveLength(1);
  });

  it('removes an existing completion instead of duplicating it', () => {
    const { toggleHabitCompletionOn } = useHabitStore.getState();
    toggleHabitCompletionOn('reading', '2026-08-18');

    const { completions } = useHabitStore.getState();
    expect(
      completions.some(
        (completion) => completion.habitId === 'reading' && completion.date === '2026-08-18',
      ),
    ).toBe(false);
  });

  it('is idempotent across a toggle pair', () => {
    const before = useHabitStore.getState().completions.length;
    const { toggleHabitCompletionOn } = useHabitStore.getState();

    toggleHabitCompletionOn('reading', '2026-08-09');
    toggleHabitCompletionOn('reading', '2026-08-09');

    expect(useHabitStore.getState().completions).toHaveLength(before);
  });

  it('ignores an unknown habit', () => {
    const before = useHabitStore.getState().completions.length;
    useHabitStore.getState().toggleHabitCompletionOn('no-such-habit', '2026-08-18');

    expect(useHabitStore.getState().completions).toHaveLength(before);
  });

  it('adds a habit and returns its id', () => {
    const habitId = useHabitStore.getState().addHabit({
      label: 'Stretching',
      frequency: 'daily',
      target: 1,
    });

    expect(useHabitStore.getState().habits.some((habit) => habit.id === habitId)).toBe(true);
  });

  it('updates a habit in place', () => {
    useHabitStore.getState().updateHabit('workout', { target: 5 });

    const updatedHabit = useHabitStore.getState().habits.find((habit) => habit.id === 'workout');
    expect(updatedHabit?.target).toBe(5);
  });

  it('removes a habit and cascades to its completions', () => {
    useHabitStore.getState().removeHabit('reading');

    const { completions, habits } = useHabitStore.getState();
    expect(habits.some((habit) => habit.id === 'reading')).toBe(false);
    expect(completions.some((completion) => completion.habitId === 'reading')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — `toggleHabitCompletionOn` is not a function.

- [ ] **Step 3: Rewrite the store**

Replace `apps/just-do-it/src/features/habits/habit-store.ts` with:

```ts
import { create } from 'zustand';

import {
  getInitialHabitCompletions,
  getInitialHabits,
  habitCompletionSchema,
  habitSchema,
} from './habit-data';
import { toHabitDateKey } from './habit-selectors';
import type { Habit, HabitCompletion, HabitInput, HabitUpdateInput } from './types';

type HabitStoreState = {
  habits: Habit[];
  completions: HabitCompletion[];
  toggleHabitCompletionOn: (habitId: string, dateKey: string) => void;
  addHabit: (input: HabitInput) => string;
  updateHabit: (habitId: string, input: HabitUpdateInput) => void;
  removeHabit: (habitId: string) => void;
};

function buildHabitRecord(habitId: string, input: HabitUpdateInput, existingHabit?: Habit): Habit {
  const frequency = input.frequency ?? existingHabit?.frequency ?? 'daily';
  const requestedTarget = input.target ?? existingHabit?.target ?? 1;

  return habitSchema.parse({
    id: existingHabit?.id ?? habitId,
    label: input.label ?? existingHabit?.label,
    description: input.description ?? existingHabit?.description,
    frequency,
    // The schema refuses a daily habit with any other target; normalize rather than throw.
    target: frequency === 'daily' ? 1 : requestedTarget,
    createdAt: existingHabit?.createdAt ?? toHabitDateKey(new Date()),
    // Temporary: habitDaysSchema still requires five booleans until Task 4
    // removes the field. A habit added in-session needs a valid placeholder.
    days: existingHabit?.days ?? [false, false, false, false, false],
  });
}

function buildHabitCompletionRecord(
  completionId: string,
  habitId: string,
  dateKey: string,
): HabitCompletion {
  return habitCompletionSchema.parse({ id: completionId, habitId, date: dateKey });
}

export const useHabitStore = create<HabitStoreState>()((set) => ({
  habits: getInitialHabits(),
  completions: getInitialHabitCompletions(),
  toggleHabitCompletionOn: (habitId, dateKey) => {
    set((state) => {
      if (!state.habits.some((habit) => habit.id === habitId)) return state;

      const existingCompletion = state.completions.find(
        (completion) => completion.habitId === habitId && completion.date === dateKey,
      );

      if (existingCompletion) {
        return {
          completions: state.completions.filter(
            (completion) => completion.id !== existingCompletion.id,
          ),
        };
      }

      return {
        completions: [
          ...state.completions,
          buildHabitCompletionRecord(crypto.randomUUID(), habitId, dateKey),
        ],
      };
    });
  },
  addHabit: (input) => {
    const habitId = crypto.randomUUID();

    set((state) => ({
      habits: [...state.habits, buildHabitRecord(habitId, input)],
    }));

    return habitId;
  },
  updateHabit: (habitId, input) => {
    set((state) => ({
      habits: state.habits.map((habit) =>
        habit.id === habitId ? buildHabitRecord(habitId, input, habit) : habit,
      ),
    }));
  },
  removeHabit: (habitId) => {
    set((state) => ({
      habits: state.habits.filter((habit) => habit.id !== habitId),
      completions: state.completions.filter((completion) => completion.habitId !== habitId),
    }));
  },
}));
```

Two things in that file exist only because Task 4 has not run yet: the `days` placeholder, and the `toHabitDateKey` import used for a new habit's `createdAt` (that one stays).

- [ ] **Step 4: Rewrite the hooks**

Replace `apps/just-do-it/src/features/habits/hooks.ts` with:

```ts
import { useHabitStore } from './habit-store';
import type { Habit } from './types';

export function useHabits() {
  return useHabitStore((state) => state.habits);
}

export function useHabitCompletions() {
  return useHabitStore((state) => state.completions);
}

export function useHabitById(habitId: string): Habit | null {
  return useHabitStore((state) => state.habits.find((habit) => habit.id === habitId) ?? null);
}

export function useToggleHabitCompletion() {
  return useHabitStore((state) => state.toggleHabitCompletionOn);
}

export function useAddHabit() {
  return useHabitStore((state) => state.addHabit);
}

export function useUpdateHabit() {
  return useHabitStore((state) => state.updateHabit);
}

export function useRemoveHabit() {
  return useHabitStore((state) => state.removeHabit);
}
```

`useSetHabitCompletion` is dropped. Remove it from the barrel's hook exports and add the new hooks.

- [ ] **Step 5: Run the store tests**

Run: `pnpm test`
Expected: the `habit-store.test.ts` suite passes. `pnpm build` will still fail — the consumers have not been ported yet. That is expected; do not commit here.

- [ ] **Step 6: Port the Today page**

In `apps/just-do-it/src/routes/today-page.tsx`:

Replace the habits import block with:

```ts
import {
  selectCurrentStreak,
  selectPeriodProgress,
  selectRecentCompletionDays,
  toHabitDateKey,
  useHabitCompletions,
  useHabits,
  useToggleHabitCompletion,
} from '../features/habits';
```

Delete `const todayHabitIndex = HABIT_DAY_COUNT - 1;` (line 24) and the `subDays` import if it becomes unused.

In the component body, replace the habit derivations (lines 77–80):

```ts
const completions = useHabitCompletions();
const todayKey = toHabitDateKey(now);
const checkedHabitsTodayCount = habits.filter((habit) =>
  isHabitCompletedOn(completions, habit.id, todayKey),
).length;
```

Add `isHabitCompletedOn` to the import list. Delete `recentHabitDates`.

Inside the habit `map` (line 348 onward), replace `const completedToday = habit.days[todayHabitIndex];` with:

```ts
const completedToday = isHabitCompletedOn(completions, habit.id, todayKey);
const recentDays = selectRecentCompletionDays(completions, habit.id, 5, now);
const currentStreak = selectCurrentStreak(habit, completions, now);
const periodProgress = selectPeriodProgress(habit, completions, now);
```

Replace the "recent check-ins" line (lines 362–364) with a streak plus period line:

```tsx
<p className="mt-1 text-sm text-[var(--muted-foreground)]">
  {currentStreak > 0
    ? `${currentStreak} ${habit.frequency === 'daily' ? 'day' : 'week'}${currentStreak === 1 ? '' : 's'} running`
    : 'No streak yet'}
  {' · '}
  {periodProgress.completed}/{periodProgress.target}{' '}
  {habit.frequency === 'daily' ? 'today' : 'this week'}
</p>
```

Replace the `onClick` (line 375) with:

```tsx
onClick={() => toggleHabitCompletion(habit.id, todayKey)}
```

Replace the day-cell block (lines 382–404) with a `HabitDayGrid` call — **but that component does not exist until Task 5**. For this task, inline the equivalent over `recentDays`:

```tsx
<div aria-hidden="true" className="mt-4 flex items-center gap-2">
  {recentDays.map((day) => (
    <div className="flex flex-col items-center gap-1" key={toHabitDateKey(day.date)}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        {format(day.date, 'EEEEE')}
      </span>
      <span
        className={cn(
          'size-7 rounded-full border',
          day.complete
            ? 'border-[var(--primary)] bg-[var(--primary)]'
            : 'border-[var(--border)] bg-[var(--surface)]',
          toHabitDateKey(day.date) === todayKey
            ? 'ring-2 ring-[var(--ring)] ring-offset-2 ring-offset-[var(--surface-muted)]'
            : '',
        )}
      />
    </div>
  ))}
</div>
```

Task 5 replaces this block with the shared component.

- [ ] **Step 7: Port the calendar page**

In `apps/just-do-it/src/routes/calendar-page.tsx`:

Delete `createHabitActivityMap` entirely (lines 133–154) and replace it with:

```ts
function createHabitActivityMap(
  habits: readonly Habit[],
  completions: readonly HabitCompletion[],
): Map<string, string[]> {
  const labelsByHabitId = new Map(habits.map((habit) => [habit.id, habit.label]));
  const habitActivityByDate = new Map<string, string[]>();

  for (const [dateKey, habitIds] of selectHabitCompletionsByDate(completions)) {
    const labels = habitIds
      .map((habitId) => labelsByHabitId.get(habitId))
      .filter((label): label is string => Boolean(label));

    if (labels.length > 0) {
      habitActivityByDate.set(dateKey, labels);
    }
  }

  return habitActivityByDate;
}
```

Update the import to:

```ts
import {
  selectHabitCompletionsByDate,
  useHabitCompletions,
  useHabits,
  type Habit,
  type HabitCompletion,
} from '../features/habits';
```

`HABIT_DAY_COUNT` is no longer imported. Check whether `addDays` and `toIsoDateKey` are still used elsewhere in the file before removing them — `toIsoDateKey` almost certainly is.

In `CalendarPage`, add `const completions = useHabitCompletions();` next to `const habits = useHabits();` and change the memo (line 429):

```ts
const habitActivityByDate = useMemo(
  () => createHabitActivityMap(habits, completions),
  [completions, habits],
);
```

Everything downstream keeps the same `Map<string, string[]>` shape, so `createCalendarIndicators`, `createAgendaItems` and `countHabitCheckInsInMonth` are untouched.

- [ ] **Step 8: Update the dashboard aggregation**

In `apps/just-do-it/src/data/dashboard.ts`, add the completion fixture:

```ts
import { validatedHabitCompletionFixture, validatedHabitFixture } from '../features/habits';

export const dashboardData = {
  tasks: validatedTaskFixture,
  habits: validatedHabitFixture,
  habitCompletions: validatedHabitCompletionFixture,
  goal: validatedGoalData[0],
};
```

Leave the rest of the file alone. Nothing imports `dashboardData`; it is dead code, and fixing that is out of scope here.

- [ ] **Step 9: Run everything**

Run: `pnpm test && pnpm build && pnpm lint && pnpm format:check`
Expected: all pass.

- [ ] **Step 10: Look at the running app**

Run: `pnpm dev`, open `/today` and `/calendar`.
Expected: the Today strip shows five real weekday letters ending today, toggling a habit flips the last cell and updates the streak line, and the calendar's habit chips now reflect the twelve weeks of fixture history rather than five anchored slots. The month's "Habit activity" count should be substantially larger than before.

- [ ] **Step 11: Commit**

```bash
pnpm format
git add apps/just-do-it/src
git commit -m "refactor(today,calendar): derive habit activity from real dates"
```

---

### Task 4: Delete the positional model

Pure deletion. Nothing reads `days` or `HABIT_DAY_COUNT` after Task 3, so this is safe and the build proves it.

**Files:**

- Modify: `apps/just-do-it/src/features/habits/types.ts`
- Modify: `apps/just-do-it/src/features/habits/habit-data.ts`
- Modify: `apps/just-do-it/src/features/habits/habit-selectors.ts`
- Modify: `apps/just-do-it/src/features/habits/habit-store.ts`
- Modify: `apps/just-do-it/src/features/habits/index.ts`
- Modify: `apps/just-do-it/src/data/habits.json`

**Interfaces:**

- Consumes: Task 3's ported consumers.
- Produces: the final `Habit` type, with no `days` field.

- [ ] **Step 1: Remove the field and the constant**

In `types.ts`, delete `export const HABIT_DAY_COUNT = 5;` and the `days: boolean[];` member of `Habit`.

- [ ] **Step 2: Remove the schema and clone support**

In `habit-data.ts`: delete `habitDaysSchema`, the `days: habitDaysSchema` line, and the `HABIT_DAY_COUNT` import. Simplify `cloneHabit` to `return { ...habit };`.

- [ ] **Step 3: Remove the leftover selector and store field**

In `habit-selectors.ts`, delete `selectHabitCompletionCount`.
In `habit-store.ts`, delete the `days` line from `buildHabitRecord` and its comment.
In `index.ts`, drop `HABIT_DAY_COUNT` and `selectHabitCompletionCount` from the exports.

- [ ] **Step 4: Strip `days` from the fixture**

Remove the `"days": [...]` key from all four entries of `apps/just-do-it/src/data/habits.json`.

- [ ] **Step 5: Remove `days` from the test fixtures**

In `habit-data.test.ts`, drop `days` from `baseHabit`. In `habit-selectors.test.ts`, drop `days: []` from `dailyHabit` and `weeklyHabit`.

- [ ] **Step 6: Run everything**

Run: `pnpm test && pnpm build && pnpm lint && pnpm format:check`
Expected: all pass. A `TS2339: Property 'days' does not exist` here means a consumer was missed in Task 3 — fix the consumer, do not restore the field.

- [ ] **Step 7: Commit**

```bash
pnpm format
git add apps/just-do-it/src
git commit -m "refactor(habits): drop the positional days model"
```

---

### Task 5: Build the habits routes

**Files:**

- Create: `apps/just-do-it/src/features/habits/components/habit-day-grid.tsx`
- Create: `apps/just-do-it/src/routes/habits-page.tsx`
- Create: `apps/just-do-it/src/routes/habit-detail-page.tsx`
- Modify: `apps/just-do-it/src/routes/today-page.tsx`
- Modify: `apps/just-do-it/src/features/habits/index.ts`
- Modify: `apps/just-do-it/src/App.tsx`
- Modify: `just-do-it-implementation-plan.md`

**Interfaces:**

- Consumes: every selector from Task 2 and every store action and hook from Task 3.
- Produces: `HabitDayGrid`, `HabitsPage`, `HabitDetailPage`.

**On the size of this task:** the two route files will land at roughly 250 and 300 lines of mostly JSX. This plan gives the shared component verbatim, the routing verbatim, and the data wiring verbatim, then describes the presentation. That is deliberate — `lists-page.tsx` and `list-detail-page.tsx` are near-exact structural precedents sitting in the repo, and transcribing 500 lines of JSX into a plan would be less useful than pointing at them. Read both before starting.

- [ ] **Step 1: Create the shared day grid**

Create `apps/just-do-it/src/features/habits/components/habit-day-grid.tsx`:

```tsx
import { format } from 'date-fns';

import { cn } from '@just-do-it/ui';
import { toHabitDateKey } from '../habit-selectors';

type HabitDayGridProps = {
  days: readonly { date: Date; complete: boolean }[];
  highlightDateKey?: string;
  showWeekdayLabels?: boolean;
  size?: 'small' | 'medium';
};

export function HabitDayGrid({
  days,
  highlightDateKey,
  showWeekdayLabels = true,
  size = 'medium',
}: HabitDayGridProps) {
  return (
    <div aria-hidden="true" className="flex items-center gap-2">
      {days.map((day) => {
        const dateKey = toHabitDateKey(day.date);

        return (
          <div className="flex flex-col items-center gap-1" key={dateKey}>
            {showWeekdayLabels ? (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                {format(day.date, 'EEEEE')}
              </span>
            ) : null}
            <span
              className={cn(
                'rounded-full border',
                size === 'small' ? 'size-4' : 'size-7',
                day.complete
                  ? 'border-[var(--primary)] bg-[var(--primary)]'
                  : 'border-[var(--border)] bg-[var(--surface)]',
                dateKey === highlightDateKey
                  ? 'ring-2 ring-[var(--ring)] ring-offset-2 ring-offset-[var(--surface-muted)]'
                  : '',
              )}
            />
          </div>
        );
      })}
    </div>
  );
}
```

Export it from the barrel: `export { HabitDayGrid } from './components/habit-day-grid';`

Then replace the inlined day-cell block added in Task 3 Step 6 of `today-page.tsx` with:

```tsx
<div className="mt-4">
  <HabitDayGrid days={recentDays} highlightDateKey={todayKey} />
</div>
```

`HabitDayGrid` deliberately takes no `className` — spacing is the caller's business, so the wrapper carries it.

- [ ] **Step 2: Build `/habits`**

Create `apps/just-do-it/src/routes/habits-page.tsx`, modelled on `lists-page.tsx`. Data wiring, verbatim:

```tsx
export function HabitsPage() {
  const now = new Date();
  const habits = useHabits();
  const completions = useHabitCompletions();
  const toggleHabitCompletion = useToggleHabitCompletion();
  const addHabit = useAddHabit();
  const todayKey = toHabitDateKey(now);

  const [newHabitLabel, setNewHabitLabel] = useState('');
  const [newHabitFrequency, setNewHabitFrequency] = useState<HabitFrequency>('daily');
  const [newHabitTarget, setNewHabitTarget] = useState(3);

  const checkedTodayCount = habits.filter((habit) =>
    isHabitCompletedOn(completions, habit.id, todayKey),
  ).length;
  const bestCurrentStreak = habits.reduce(
    (best, habit) => Math.max(best, selectCurrentStreak(habit, completions, now)),
    0,
  );

  function createHabit() {
    const label = newHabitLabel.trim();
    if (!label) return;

    addHabit({
      label,
      frequency: newHabitFrequency,
      target: newHabitFrequency === 'daily' ? 1 : newHabitTarget,
    });

    setNewHabitLabel('');
  }

  // ...presentation
}
```

Presentation, following `lists-page.tsx`'s structure:

- A page header (`h1` + description paragraph) matching the other routes' copy tone.
- A three-stat `Card` row: habits tracked, `checkedTodayCount`/`habits.length` checked in today, `bestCurrentStreak` best run.
- A create form: an `Input` for the label, a `frequency` toggle (two `Button`s, `variant` switching on selection — there is no `Select` primitive in `packages/ui` and this plan does not add one), and a target `Input type="number"` shown only when `frequency === 'weekly'`.
- One `Card` per habit containing: the label as a `Link` to `/habits/${habit.id}`, a `Badge` reading `Daily` or `${habit.target}× per week`, the current streak, `<HabitDayGrid days={selectRecentCompletionDays(completions, habit.id, 7, now)} highlightDateKey={todayKey} />`, and a check-in `Button` calling `toggleHabitCompletion(habit.id, todayKey)` with the same `aria-label`/`aria-pressed` pattern `today-page.tsx` uses.
- An empty state when `habits.length === 0`, matching the wording style of the other routes' empty states.

- [ ] **Step 3: Build `/habits/:habitId`**

Create `apps/just-do-it/src/routes/habit-detail-page.tsx`, modelled on `list-detail-page.tsx`. Data wiring, verbatim:

```tsx
export function HabitDetailPage() {
  const { habitId = '' } = useParams();
  const navigate = useNavigate();
  const now = new Date();
  const habit = useHabitById(habitId);
  const completions = useHabitCompletions();
  const toggleHabitCompletion = useToggleHabitCompletion();
  const updateHabit = useUpdateHabit();
  const removeHabit = useRemoveHabit();

  if (!habit) {
    return (
      <Card>
        <h1 className="text-lg font-bold">Habit not found</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          This habit is no longer being tracked.
        </p>
        <Link
          className="mt-4 inline-block text-sm font-semibold text-[var(--primary)]"
          to="/habits"
        >
          Back to habits
        </Link>
      </Card>
    );
  }

  // Capture after the guard: hoisted function declarations below do not narrow
  // through `habit`, which is exactly the TS18047 bug the Lists work hit.
  const activeHabit = habit;
  const todayKey = toHabitDateKey(now);
  const currentStreak = selectCurrentStreak(activeHabit, completions, now);
  const longestStreak = selectLongestStreak(activeHabit, completions);
  const completionRate = selectCompletionRate(activeHabit, completions, now);
  const historyDays = selectRecentCompletionDays(completions, activeHabit.id, 84, now);

  // ...presentation
}
```

**Do not skip the `const activeHabit = habit` line.** The `if (!habit) return` guard does not narrow inside hoisted `function` handlers declared below it — that produced four `TS18047: 'habit' is possibly 'null'` errors in the Lists work, and `pnpm build` is the only thing that catches it.

Presentation:

- A back `Link` to `/habits`, the label as `h1`, the description below it.
- A stat row: current streak, longest streak, completion rate as `Math.round(completionRate * 100)`%.
- A twelve-week heatmap: chunk `historyDays` into twelve rows of seven with a small helper, and render each row as `<HabitDayGrid days={week} showWeekdayLabels={false} size="small" highlightDateKey={todayKey} />`. Since `historyDays` ends today and today is a Tuesday, the first row will not start on a Monday — that is acceptable for a rolling 84-day view; do not add week alignment logic.
- An edit form (label, description, frequency, target) calling `updateHabit(activeHabit.id, ...)`, following `list-detail-page.tsx`'s inline edit pattern.
- A delete `Button` calling `removeHabit(activeHabit.id)` then `navigate('/habits')`.

- [ ] **Step 4: Wire the routes**

In `apps/just-do-it/src/App.tsx`, add the imports and replace the placeholder:

```tsx
import { HabitDetailPage } from './routes/habit-detail-page';
import { HabitsPage } from './routes/habits-page';
```

```tsx
<Route path="/habits" element={<HabitsPage />} />
<Route path="/habits/:habitId" element={<HabitDetailPage />} />
```

`PlaceholderPage` is still used by `/settings`, so keep its import.

- [ ] **Step 5: Run everything**

Run: `pnpm test && pnpm build && pnpm lint && pnpm format:check`
Expected: all pass.

- [ ] **Step 6: Look at the running app**

Run: `pnpm dev`. Check, against the fixture's intended state on 2026-08-18:

| Habit                                | Expected current streak | Expected longest |
| ------------------------------------ | ----------------------- | ---------------- |
| Reading (daily)                      | 9 days                  | 14 days          |
| Meditation (daily)                   | 2 days                  | 11 days          |
| Workout (weekly, target 4)           | 6 weeks                 | 6 weeks          |
| Language practice (weekly, target 3) | 0 weeks                 | 5 weeks          |

If these do not match, the selectors are wrong or the fixture generator ran with different runs — debug the selector against a hand-written case in the test file first, not against the fixture.

Also confirm: toggling on `/habits` updates Today and the calendar (one shared store), deleting a habit removes its calendar chips, and the theme toggle still works in both light and dark.

- [ ] **Step 7: Update the implementation plan**

In `just-do-it-implementation-plan.md`:

- Tick all six Phase 13 boxes.
- In §3's status table, mark Phase 13 **Done** and update the Tests row — tests now exist for habit selectors, schemas, and the store, and nowhere else.
- In §6, remove the `/habits` placeholder bullet (`/settings` still applies), and add two: the fixture-staleness note from the spec, and the observation that `src/data/dashboard.ts` is dead code despite CLAUDE.md describing it as the cross-domain aggregation point.
- In §5, replace the habits paragraph describing the positional array with the built model.

Also update `CLAUDE.md`: the "no test runner anywhere" bullet is now false. Replace it with what is actually true — vitest runs via `pnpm test`, covering only habit selectors/schemas/store plus one lists selector; routes and components remain untested.

- [ ] **Step 8: Commit**

```bash
pnpm format
git add apps/just-do-it/src just-do-it-implementation-plan.md CLAUDE.md
git commit -m "feat(habits): add habits list and detail routes"
```

---

## Final verification

- [ ] `pnpm test` — all suites pass
- [ ] `pnpm build` — passes (the authoritative typecheck)
- [ ] `pnpm lint` — passes
- [ ] `pnpm format:check` — passes
- [ ] `git log --oneline main..feat/habits-domain` shows six commits: the spec, vitest, the model, the consumer refactor, the deletion, the routes
- [ ] `grep -rn "HABIT_DAY_COUNT\|habit.days\|selectHabitCompletionCount" apps/just-do-it/src` returns nothing
- [ ] The app runs and the four streak values match the table in Task 5 Step 6

Note what is **not** verified: no route or component has a test. A green run proves the selectors, schemas, and store behave and that everything typechecks. It says nothing about whether the pages render correctly — that is manual.
