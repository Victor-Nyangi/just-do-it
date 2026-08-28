# Calendar Selectors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the 224 lines of pure date-mapping logic out of `routes/calendar-page.tsx` into a `features/calendar/` module, then test it — closing the last substantial untested logic in the repo.

**Architecture:** A sixth feature module following the existing file-name convention, with no store and no hooks: calendar owns no state and derives everything from tasks, habits and goals. It is the first feature to import other features, which `CLAUDE.md` forbids as written, so the rule gains an explicit one-way, barrel-only carve-out.

**Tech Stack:** TypeScript, React 19, date-fns 4.1, vitest (node environment), Tailwind v4, pnpm 10 + Turborepo.

**Spec:** `docs/superpowers/specs/2026-08-27-calendar-selectors-design.md`

## Global Constraints

- **Run every command from the repo root**, not from `apps/just-do-it`.
- **Run `pnpm format` before every commit.** No pre-commit hook exists; CI fails on drift. Prettier: semicolons, single quotes, trailing commas, 100 columns.
- **Variable names are spelled out in full.** No single-letter or abbreviated identifiers.
- **Dates come from `date-fns`.** No hand-rolled date arithmetic.
- **`features/<domain>/index.ts` is an explicit named-export barrel.** No `export *`.
- **Routes import from `'../features/<domain>'`**, never a deeper path. Inside a feature, modules import siblings directly (`'../tasks'` is a barrel import and is correct here; `'../tasks/task-selectors'` would not be).
- **Test expectations are hand-written literals**, never computed with the code under test.
- **Colours are CSS custom properties only.** No hex, no Tailwind palette classes.
- **Conventional Commits scoped by domain**, e.g. `refactor(calendar):`. Branch `feat/calendar-selectors` already exists and is checked out.
- **`pnpm dev` needs polling on this machine** (inotify budget is exhausted): `CHOKIDAR_USEPOLLING=1 CHOKIDAR_INTERVAL=1000 pnpm --filter @just-do-it/app exec vite --host 127.0.0.1 --port 5173`.

### What enforces cleanup

`.oxlintrc.json` enables only `react/rules-of-hooks` and `react/only-export-components` — it does **not** flag unused imports. `tsconfig.app.json` sets `noUnusedLocals: true` and `noUnusedParameters: true`, so `pnpm typecheck` is what fails on a leftover import, with `TS6133`.

---

### Task 1: Move the logic into `features/calendar`

**This task changes no behaviour.** It is a pure move, so the usual red-green cycle does not apply: there is no failing test to write first, because the code already works and its observable behaviour must be identical afterwards. Verification is the type checker, the existing suite, the build, and reading the diff. Tests arrive in Task 2.

**Files:**

- Modify: `packages/ui/src/index.ts` (export `BadgeTone`)
- Modify: `packages/ui/src/components/badge.tsx` (export the type declaration)
- Create: `apps/just-do-it/src/features/calendar/types.ts`
- Create: `apps/just-do-it/src/features/calendar/calendar-selectors.ts`
- Create: `apps/just-do-it/src/features/calendar/index.ts`
- Modify: `apps/just-do-it/src/routes/calendar-page.tsx` (delete lines 39–64 and 85–320, rewire imports)

**Interfaces:**

- Consumes: `Task` from `'../tasks'`; `Habit`, `HabitCompletion`, `selectHabitCompletionsByDate` from `'../habits'`; `Goal`, `formatGoalDeadlineLabel` from `'../goals'`; `BadgeTone` from `'@just-do-it/ui'`.
- Produces, all via `features/calendar/index.ts`: the types `AgendaItem`, `AgendaItemKind`, `AgendaMode`, `DayIndicators`, `GoalTarget`, and the functions `countHabitCheckInsInMonth`, `createAgendaItems`, `createCalendarIndicators`, `createEmptyDayIndicators`, `createGoalTargets`, `createHabitActivityMap`, `createMonthSelection`, `createTaskMap`, `getDayButtonLabel`, `getIndicatorsForDate`, `getTaskAgendaTone`, `pluralize`, `toIsoDateKey`. Task 2 tests all of these; Task 4 documents them.

- [ ] **Step 1: Export `BadgeTone` from the UI package**

`BadgeTone` is declared in `packages/ui/src/components/badge.tsx` but never exported, so the calendar route declares a second identical copy. Export it so the new module imports one definition instead of entrenching the duplicate.

In `packages/ui/src/components/badge.tsx`, change the declaration to export it:

```ts
export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning';
```

In `packages/ui/src/index.ts`, add the type export alongside the existing ones:

```ts
export type { BadgeTone } from './components/badge';
```

- [ ] **Step 2: Create the types module**

Create `apps/just-do-it/src/features/calendar/types.ts`. These are lines 58–83 of `calendar-page.tsx` verbatim, minus `BadgeTone` which now comes from the UI package:

```ts
import type { BadgeTone } from '@just-do-it/ui';

export const AGENDA_MODE_VALUES = ['day', 'week'] as const;
export const AGENDA_ITEM_KIND_VALUES = ['task', 'habit', 'goal'] as const;

export type AgendaMode = (typeof AGENDA_MODE_VALUES)[number];
export type AgendaItemKind = (typeof AGENDA_ITEM_KIND_VALUES)[number];

export type DayIndicators = {
  tasks: number;
  habits: number;
  goals: number;
};

export type GoalTarget = {
  id: string;
  title: string;
  progress: number;
  targetDate: Date;
};

export type AgendaItem = {
  id: string;
  kind: AgendaItemKind;
  title: string;
  description: string;
  badge: string;
  date: Date;
  tone: BadgeTone;
};
```

The `X_VALUES as const` arrays follow the convention in every other domain's `types.ts` — the union derives from the array so the two cannot drift. The originals were bare unions; deriving them here costs nothing and matches the house pattern.

- [ ] **Step 3: Create the selectors module**

Create `apps/just-do-it/src/features/calendar/calendar-selectors.ts`. Every function below is lifted verbatim from `calendar-page.tsx` lines 85 and 97–320, with `export` added. **Do not rewrite the bodies** — a behaviour change here is a defect, and Task 2's tests assume exactly this behaviour.

```ts
import {
  compareAsc,
  format,
  getDate,
  getDaysInMonth,
  getMonth,
  getYear,
  isSameMonth,
  parseISO,
  startOfDay,
} from 'date-fns';

import type { BadgeTone } from '@just-do-it/ui';
import { formatGoalDeadlineLabel, type Goal } from '../goals';
import { selectHabitCompletionsByDate, type Habit, type HabitCompletion } from '../habits';
import type { Task } from '../tasks';
import type { AgendaItem, AgendaItemKind, DayIndicators, GoalTarget } from './types';

const agendaKindOrder: Record<AgendaItemKind, number> = {
  task: 0,
  goal: 1,
  habit: 2,
};

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function toIsoDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function createEmptyDayIndicators(): DayIndicators {
  return {
    tasks: 0,
    habits: 0,
    goals: 0,
  };
}

export function createMonthSelection(currentSelection: Date, nextMonth: Date): Date {
  const nextDayOfMonth = Math.min(getDate(currentSelection), getDaysInMonth(nextMonth));

  return startOfDay(new Date(getYear(nextMonth), getMonth(nextMonth), nextDayOfMonth));
}

export function createTaskMap(tasks: readonly Task[]): Map<string, Task[]> {
  const tasksByDate = new Map<string, Task[]>();

  for (const task of tasks) {
    if (!task.dueDate) continue;

    const currentTasks = tasksByDate.get(task.dueDate);

    if (currentTasks) {
      currentTasks.push(task);
      continue;
    }

    tasksByDate.set(task.dueDate, [task]);
  }

  return tasksByDate;
}

export function createHabitActivityMap(
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

export function createGoalTargets(goals: readonly Goal[]): GoalTarget[] {
  return [...goals]
    .map((goal) => ({
      id: goal.id,
      title: goal.title,
      progress: goal.progress,
      targetDate: startOfDay(parseISO(goal.targetDate)),
    }))
    .sort((leftTarget, rightTarget) => compareAsc(leftTarget.targetDate, rightTarget.targetDate));
}

export function getTaskAgendaTone(task: Task): BadgeTone {
  if (task.status === 'completed') return 'success';
  if (task.priority === 'urgent' || task.priority === 'high') return 'warning';
  if (task.status === 'in_progress') return 'accent';

  return 'neutral';
}

export function createAgendaItems(
  tasks: readonly Task[],
  habitActivityByDate: Map<string, string[]>,
  goalTargets: readonly GoalTarget[],
  now = new Date(),
): AgendaItem[] {
  const agendaItems: AgendaItem[] = [];

  for (const task of tasks) {
    if (!task.dueDate) continue;

    agendaItems.push({
      id: `task-${task.id}`,
      kind: 'task',
      title: task.title,
      description:
        task.description ??
        `${task.priority.replace(/\b\w/gu, (character) => character.toUpperCase())} priority · ${task.category}`,
      badge:
        task.status === 'completed'
          ? 'Completed task'
          : task.status === 'in_progress'
            ? 'In progress'
            : 'Due task',
      date: parseISO(task.dueDate),
      tone: getTaskAgendaTone(task),
    });
  }

  for (const [dateKey, labels] of habitActivityByDate) {
    agendaItems.push({
      id: `habit-${dateKey}`,
      kind: 'habit',
      title: pluralize(labels.length, 'habit check-in'),
      description: labels.join(', '),
      badge: 'Habit activity',
      date: parseISO(dateKey),
      tone: 'success',
    });
  }

  for (const goalTarget of goalTargets) {
    agendaItems.push({
      id: `goal-${goalTarget.id}`,
      kind: 'goal',
      title: goalTarget.title,
      description: `${goalTarget.progress}% complete · ${formatGoalDeadlineLabel(toIsoDateKey(goalTarget.targetDate), now)}`,
      badge: 'Goal target',
      date: goalTarget.targetDate,
      tone: 'accent',
    });
  }

  return agendaItems.sort((leftItem, rightItem) => {
    const dateComparison = compareAsc(leftItem.date, rightItem.date);

    if (dateComparison !== 0) return dateComparison;

    const kindComparison = agendaKindOrder[leftItem.kind] - agendaKindOrder[rightItem.kind];

    if (kindComparison !== 0) return kindComparison;

    return leftItem.title.localeCompare(rightItem.title);
  });
}

export function createCalendarIndicators(
  tasksByDate: Map<string, Task[]>,
  habitActivityByDate: Map<string, string[]>,
  goalTargets: readonly GoalTarget[],
): Map<string, DayIndicators> {
  const indicatorsByDate = new Map<string, DayIndicators>();

  for (const [dateKey, dayTasks] of tasksByDate) {
    indicatorsByDate.set(dateKey, {
      ...createEmptyDayIndicators(),
      tasks: dayTasks.length,
    });
  }

  for (const [dateKey, labels] of habitActivityByDate) {
    const currentIndicators = indicatorsByDate.get(dateKey) ?? createEmptyDayIndicators();

    indicatorsByDate.set(dateKey, {
      ...currentIndicators,
      habits: labels.length,
    });
  }

  for (const goalTarget of goalTargets) {
    const dateKey = toIsoDateKey(goalTarget.targetDate);
    const currentIndicators = indicatorsByDate.get(dateKey) ?? createEmptyDayIndicators();

    indicatorsByDate.set(dateKey, {
      ...currentIndicators,
      goals: currentIndicators.goals + 1,
    });
  }

  return indicatorsByDate;
}

export function getIndicatorsForDate(
  indicatorsByDate: Map<string, DayIndicators>,
  date: Date,
): DayIndicators {
  return indicatorsByDate.get(toIsoDateKey(date)) ?? createEmptyDayIndicators();
}

export function countHabitCheckInsInMonth(
  habitActivityByDate: Map<string, string[]>,
  month: Date,
): number {
  let total = 0;

  for (const [dateKey, labels] of habitActivityByDate) {
    if (!isSameMonth(parseISO(dateKey), month)) continue;

    total += labels.length;
  }

  return total;
}

export function getDayButtonLabel(date: Date, indicators: DayIndicators): string {
  const parts = [format(date, 'EEEE, MMMM d, yyyy')];

  if (indicators.tasks > 0) {
    parts.push(pluralize(indicators.tasks, 'due task'));
  }

  if (indicators.habits > 0) {
    parts.push(pluralize(indicators.habits, 'habit check-in'));
  }

  if (indicators.goals > 0) {
    parts.push(pluralize(indicators.goals, 'goal target'));
  }

  if (parts.length === 1) {
    parts.push('No scheduled items');
  }

  return parts.join('. ');
}
```

**One deliberate deviation from the pure move: `createAgendaItems` gains a `now` parameter.**

In the original, its goal descriptions call `formatGoalDeadlineLabel(...)` with no anchor date, and
that helper defaults to `new Date()` — so the function silently reads the system clock and is not
pure. Proven by running it against one fixed input under two fake clocks:

```
on 2026-08-19  ->  "40% complete · Due tomorrow"
on 2026-07-01  ->  "40% complete · 50 days left"
```

That is the same class of latent bug as the selector that accepted a `now` and then called
`isToday()` internally, fixed in `750c81d`. Left alone it would make any future test of a goal
description flaky, and it violates the repo's own convention that date logic takes an injectable
`now`. The default keeps behaviour identical, so the route needs no change.

- [ ] **Step 4: Create the barrel**

Create `apps/just-do-it/src/features/calendar/index.ts`:

```ts
export {
  countHabitCheckInsInMonth,
  createAgendaItems,
  createCalendarIndicators,
  createEmptyDayIndicators,
  createGoalTargets,
  createHabitActivityMap,
  createMonthSelection,
  createTaskMap,
  getDayButtonLabel,
  getIndicatorsForDate,
  getTaskAgendaTone,
  pluralize,
  toIsoDateKey,
} from './calendar-selectors';
export { AGENDA_ITEM_KIND_VALUES, AGENDA_MODE_VALUES } from './types';
export type { AgendaItem, AgendaItemKind, AgendaMode, DayIndicators, GoalTarget } from './types';
```

- [ ] **Step 5: Strip the route and rewire its imports**

In `apps/just-do-it/src/routes/calendar-page.tsx`:

1. Delete the type declarations at **lines 58–83** (`AgendaMode`, `AgendaItemKind`, `BadgeTone`, `DayIndicators`, `GoalTarget`, `AgendaItem`). Locate them by name, not by line number, in case the file has shifted.
2. Delete `agendaKindOrder` at line 85.
3. Delete every function from line 97 (`pluralize`) through line 320 (the end of `getDayButtonLabel`).
4. Keep `weekdayLabels` and `allTaskFilters` — they are presentation and route config.
5. Add one import from the new barrel, alphabetised:

```ts
import {
  countHabitCheckInsInMonth,
  createAgendaItems,
  createCalendarIndicators,
  createGoalTargets,
  createHabitActivityMap,
  createMonthSelection,
  createTaskMap,
  getDayButtonLabel,
  getIndicatorsForDate,
  pluralize,
  toIsoDateKey,
  type AgendaItem,
  type AgendaItemKind,
  type AgendaMode,
  type DayIndicators,
  type GoalTarget,
} from '../features/calendar';
```

**What the route still needs, verified by counting usages outside the moved block:** `pluralize`
(8 uses in the JSX), `toIsoDateKey` (2), `createMonthSelection`, `createTaskMap`,
`createHabitActivityMap`, `createGoalTargets`, `createAgendaItems`, `createCalendarIndicators`,
`getIndicatorsForDate` (2), `countHabitCheckInsInMonth`, `getDayButtonLabel`, and the types
`AgendaItem`, `AgendaItemKind` (used by the route's own `agendaIcons` map), `AgendaMode`,
`DayIndicators` and `GoalTarget`.

**`getTaskAgendaTone` and `createEmptyDayIndicators` are NOT used by the route** — they are
internal to the moved logic, so do not import them.

**`BadgeTone` comes from `@just-do-it/ui`, not from the calendar barrel.** The route uses it
outside the moved block, so add it to the existing `@just-do-it/ui` import.

`noUnusedLocals` catches anything imported and unused; a missing import is a plain compile error.
Run `pnpm typecheck` and let it arbitrate.

6. The route still imports `selectHabitCompletionsByDate` and `formatGoalDeadlineLabel` today; if the moved functions were their only consumers, `noUnusedLocals` will flag those too. Remove them, and trim the `date-fns` import list the same way — the route no longer needs `compareAsc`, `getDate`, `getDaysInMonth`, `getMonth`, `getYear` or `isSameMonth` unless its own JSX uses them.

- [ ] **Step 6: Verify the move changed no behaviour**

Run from the repo root:

```sh
pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: all green, **191 tests** — unchanged, because this task adds none.

Then read the diff and confirm the moved block differs only by `export`, imports, and the `BadgeTone` removal:

```sh
git diff -- apps/just-do-it/src/routes/calendar-page.tsx | grep '^+' | grep -v '^+++'
```

Expected: only the new import block. If any other added line appears in the route, you have accidentally rewritten logic — revert it.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/index.ts packages/ui/src/components/badge.tsx \
        apps/just-do-it/src/features/calendar/ \
        apps/just-do-it/src/routes/calendar-page.tsx
git commit -m "refactor(calendar): extract the date mapping into a feature module"
```

---

### Task 2: Test the calendar selectors

**Files:**

- Create: `apps/just-do-it/src/features/calendar/calendar-selectors.test.ts`

**Interfaces:**

- Consumes: everything Task 1 exports from `features/calendar`.
- Produces: no API. A suite proving the extracted logic behaves as the route always assumed.

These are characterization tests — the code already works, so they will pass on the first run. That proves nothing on its own, which is why Task 3 exists. Write them to catch a **wrong** implementation, not merely to execute the current one.

- [ ] **Step 1: Write the test file**

Create `apps/just-do-it/src/features/calendar/calendar-selectors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  countHabitCheckInsInMonth,
  createAgendaItems,
  createCalendarIndicators,
  createEmptyDayIndicators,
  createGoalTargets,
  createHabitActivityMap,
  createMonthSelection,
  createTaskMap,
  getDayButtonLabel,
  getIndicatorsForDate,
  getTaskAgendaTone,
  pluralize,
  toIsoDateKey,
} from './calendar-selectors';
import type { GoalTarget } from './types';
import type { Goal } from '../goals';
import type { Habit, HabitCompletion } from '../habits';
import type { Task } from '../tasks';

// Inputs are built; every expectation below is a hand-written literal.
function buildTask(overrides: Partial<Task> & Pick<Task, 'id'>): Task {
  return {
    title: overrides.id,
    status: 'todo',
    priority: 'medium',
    category: 'Personal',
    recurrence: 'none',
    recurrenceInterval: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function buildHabit(id: string, label: string): Habit {
  return { id, label, frequency: 'daily', target: 1, createdAt: '2026-01-01' };
}

function buildCompletion(habitId: string, date: string): HabitCompletion {
  return { id: `${habitId}-${date}`, habitId, date };
}

function buildGoal(overrides: Partial<Goal> & Pick<Goal, 'id'>): Goal {
  return {
    title: overrides.id,
    description: 'A goal',
    period: 'Monthly focus',
    targetDate: '2026-08-20',
    progress: 0,
    status: 'active',
    ...overrides,
  };
}

describe('pluralize', () => {
  it('uses the singular for one', () => {
    expect(pluralize(1, 'due task')).toBe('1 due task');
  });

  it('uses the plural for zero', () => {
    expect(pluralize(0, 'due task')).toBe('0 due tasks');
  });

  it('uses the plural for many', () => {
    expect(pluralize(3, 'due task')).toBe('3 due tasks');
  });

  it('accepts an irregular plural', () => {
    expect(pluralize(2, 'entry', 'entries')).toBe('2 entries');
  });
});

describe('toIsoDateKey', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(toIsoDateKey(new Date(2026, 7, 20))).toBe('2026-08-20');
  });

  it('pads single-digit months and days', () => {
    expect(toIsoDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('createEmptyDayIndicators', () => {
  it('starts every count at zero', () => {
    expect(createEmptyDayIndicators()).toEqual({ tasks: 0, habits: 0, goals: 0 });
  });

  it('returns a fresh object each call, not a shared one', () => {
    const first = createEmptyDayIndicators();
    first.tasks = 5;

    expect(createEmptyDayIndicators().tasks).toBe(0);
  });
});

describe('createMonthSelection', () => {
  it('keeps the day of month when the target month is long enough', () => {
    const selection = createMonthSelection(new Date(2026, 7, 15), new Date(2026, 8, 1));

    expect(toIsoDateKey(selection)).toBe('2026-09-15');
  });

  it('clamps to the last day when the target month is shorter', () => {
    // 31 January -> February, which has 28 days in 2026.
    const selection = createMonthSelection(new Date(2026, 0, 31), new Date(2026, 1, 1));

    expect(toIsoDateKey(selection)).toBe('2026-02-28');
  });

  it('clamps to 29 February in a leap year', () => {
    const selection = createMonthSelection(new Date(2028, 0, 31), new Date(2028, 1, 1));

    expect(toIsoDateKey(selection)).toBe('2028-02-29');
  });

  it('returns the start of the day', () => {
    const selection = createMonthSelection(new Date(2026, 7, 15, 13, 45), new Date(2026, 8, 1));

    expect(selection.getHours()).toBe(0);
    expect(selection.getMinutes()).toBe(0);
  });
});

describe('createTaskMap', () => {
  it('groups tasks under their due date', () => {
    const tasks = [
      buildTask({ id: 'first', dueDate: '2026-08-20' }),
      buildTask({ id: 'second', dueDate: '2026-08-20' }),
      buildTask({ id: 'third', dueDate: '2026-08-21' }),
    ];

    const tasksByDate = createTaskMap(tasks);

    expect(tasksByDate.get('2026-08-20')?.map((task) => task.id)).toEqual(['first', 'second']);
    expect(tasksByDate.get('2026-08-21')?.map((task) => task.id)).toEqual(['third']);
  });

  it('omits a task with no due date', () => {
    const tasksByDate = createTaskMap([buildTask({ id: 'someday' })]);

    expect(tasksByDate.size).toBe(0);
  });

  it('returns an empty map for no tasks', () => {
    expect(createTaskMap([]).size).toBe(0);
  });
});

describe('createHabitActivityMap', () => {
  const habits = [buildHabit('reading', 'Reading'), buildHabit('workout', 'Workout')];

  it('maps a date to the labels completed on it', () => {
    const completions = [buildCompletion('reading', '2026-08-20')];

    expect(createHabitActivityMap(habits, completions).get('2026-08-20')).toEqual(['Reading']);
  });

  it('collects several habits on the same day', () => {
    const completions = [
      buildCompletion('reading', '2026-08-20'),
      buildCompletion('workout', '2026-08-20'),
    ];

    expect(createHabitActivityMap(habits, completions).get('2026-08-20')).toEqual([
      'Reading',
      'Workout',
    ]);
  });

  it('drops a completion whose habit no longer exists', () => {
    const completions = [buildCompletion('deleted-habit', '2026-08-20')];

    expect(createHabitActivityMap(habits, completions).has('2026-08-20')).toBe(false);
  });

  it('keeps the surviving habits when one completion is orphaned', () => {
    const completions = [
      buildCompletion('deleted-habit', '2026-08-20'),
      buildCompletion('reading', '2026-08-20'),
    ];

    expect(createHabitActivityMap(habits, completions).get('2026-08-20')).toEqual(['Reading']);
  });

  it('returns an empty map for no completions', () => {
    expect(createHabitActivityMap(habits, []).size).toBe(0);
  });
});

describe('createGoalTargets', () => {
  it('sorts targets by date ascending', () => {
    const goals = [
      buildGoal({ id: 'later', targetDate: '2026-09-01' }),
      buildGoal({ id: 'sooner', targetDate: '2026-08-20' }),
    ];

    expect(createGoalTargets(goals).map((target) => target.id)).toEqual(['sooner', 'later']);
  });

  it('carries the title and progress through', () => {
    const target = createGoalTargets([buildGoal({ id: 'g', title: 'Ship it', progress: 40 })])[0];

    expect(target.title).toBe('Ship it');
    expect(target.progress).toBe(40);
  });

  it('leaves the source collection untouched', () => {
    const goals = [
      buildGoal({ id: 'later', targetDate: '2026-09-01' }),
      buildGoal({ id: 'sooner', targetDate: '2026-08-20' }),
    ];

    createGoalTargets(goals);

    expect(goals.map((goal) => goal.id)).toEqual(['later', 'sooner']);
  });

  it('returns an empty array for no goals', () => {
    expect(createGoalTargets([])).toEqual([]);
  });
});

describe('getTaskAgendaTone', () => {
  it('is success for a completed task, even an urgent one', () => {
    expect(getTaskAgendaTone(buildTask({ id: 't', status: 'completed', priority: 'urgent' }))).toBe(
      'success',
    );
  });

  it('is warning for an urgent task', () => {
    expect(getTaskAgendaTone(buildTask({ id: 't', priority: 'urgent' }))).toBe('warning');
  });

  it('is warning for a high-priority task', () => {
    expect(getTaskAgendaTone(buildTask({ id: 't', priority: 'high' }))).toBe('warning');
  });

  it('is warning for an urgent task that is in progress', () => {
    expect(
      getTaskAgendaTone(buildTask({ id: 't', status: 'in_progress', priority: 'urgent' })),
    ).toBe('warning');
  });

  it('is accent for an in-progress task of ordinary priority', () => {
    expect(getTaskAgendaTone(buildTask({ id: 't', status: 'in_progress' }))).toBe('accent');
  });

  it('is neutral for a plain todo', () => {
    expect(getTaskAgendaTone(buildTask({ id: 't' }))).toBe('neutral');
  });
});

describe('createAgendaItems', () => {
  const noHabits = new Map<string, string[]>();
  const noGoals: GoalTarget[] = [];

  it('is empty when every collection is empty', () => {
    expect(createAgendaItems([], noHabits, noGoals)).toEqual([]);
  });

  it('omits a task with no due date', () => {
    expect(createAgendaItems([buildTask({ id: 'someday' })], noHabits, noGoals)).toEqual([]);
  });

  it('prefixes ids by kind so they cannot collide across domains', () => {
    const items = createAgendaItems(
      [buildTask({ id: 'shared', dueDate: '2026-08-20' })],
      new Map([['2026-08-20', ['Reading']]]),
      [{ id: 'shared', title: 'Goal', progress: 10, targetDate: new Date(2026, 7, 20) }],
    );

    expect(items.map((item) => item.id)).toEqual([
      'task-shared',
      'goal-shared',
      'habit-2026-08-20',
    ]);
  });

  it('orders task before goal before habit on the same day', () => {
    const items = createAgendaItems(
      [buildTask({ id: 'a-task', dueDate: '2026-08-20' })],
      new Map([['2026-08-20', ['Reading']]]),
      [{ id: 'a-goal', title: 'Goal', progress: 10, targetDate: new Date(2026, 7, 20) }],
    );

    expect(items.map((item) => item.kind)).toEqual(['task', 'goal', 'habit']);
  });

  it('orders by date before kind', () => {
    const items = createAgendaItems(
      [buildTask({ id: 'later-task', dueDate: '2026-08-21' })],
      new Map([['2026-08-20', ['Reading']]]),
      noGoals,
    );

    expect(items.map((item) => item.id)).toEqual(['habit-2026-08-20', 'task-later-task']);
  });

  it('breaks a date and kind tie by title', () => {
    const items = createAgendaItems(
      [
        buildTask({ id: 'zulu', title: 'Zulu', dueDate: '2026-08-20' }),
        buildTask({ id: 'alpha', title: 'Alpha', dueDate: '2026-08-20' }),
      ],
      noHabits,
      noGoals,
    );

    expect(items.map((item) => item.title)).toEqual(['Alpha', 'Zulu']);
  });

  it('falls back to priority and category when a task has no description', () => {
    const items = createAgendaItems(
      [buildTask({ id: 't', dueDate: '2026-08-20', priority: 'high', category: 'Errand' })],
      noHabits,
      noGoals,
    );

    expect(items[0].description).toBe('High priority · Errand');
  });

  it('uses the task description when it has one', () => {
    const items = createAgendaItems(
      [buildTask({ id: 't', dueDate: '2026-08-20', description: 'Call the vet' })],
      noHabits,
      noGoals,
    );

    expect(items[0].description).toBe('Call the vet');
  });

  it('badges a task by its status', () => {
    const todo = createAgendaItems(
      [buildTask({ id: 'a', dueDate: '2026-08-20' })],
      noHabits,
      noGoals,
    );
    const doing = createAgendaItems(
      [buildTask({ id: 'b', dueDate: '2026-08-20', status: 'in_progress' })],
      noHabits,
      noGoals,
    );
    const done = createAgendaItems(
      [buildTask({ id: 'c', dueDate: '2026-08-20', status: 'completed' })],
      noHabits,
      noGoals,
    );

    expect(todo[0].badge).toBe('Due task');
    expect(doing[0].badge).toBe('In progress');
    expect(done[0].badge).toBe('Completed task');
  });

  it('summarises a habit day by count and lists the labels', () => {
    const items = createAgendaItems([], new Map([['2026-08-20', ['Reading', 'Workout']]]), noGoals);

    expect(items[0].title).toBe('2 habit check-ins');
    expect(items[0].description).toBe('Reading, Workout');
  });

  it('uses the singular for a single habit check-in', () => {
    const items = createAgendaItems([], new Map([['2026-08-20', ['Reading']]]), noGoals);

    expect(items[0].title).toBe('1 habit check-in');
  });

  it('describes a goal deadline relative to the injected now, not the system clock', () => {
    const goalTargets = [
      { id: 'g', title: 'Goal', progress: 40, targetDate: new Date(2026, 7, 20) },
    ];

    const dayBefore = createAgendaItems([], noHabits, goalTargets, new Date(2026, 7, 19));
    const monthBefore = createAgendaItems([], noHabits, goalTargets, new Date(2026, 6, 1));

    expect(dayBefore[0].description).toBe('40% complete · Due tomorrow');
    expect(monthBefore[0].description).toBe('40% complete · 50 days left');
  });
});

describe('createCalendarIndicators', () => {
  it('counts tasks, habits and goals on the same day together', () => {
    const indicators = createCalendarIndicators(
      new Map([['2026-08-20', [buildTask({ id: 'a' }), buildTask({ id: 'b' })]]]),
      new Map([['2026-08-20', ['Reading']]]),
      [{ id: 'g', title: 'Goal', progress: 10, targetDate: new Date(2026, 7, 20) }],
    );

    expect(indicators.get('2026-08-20')).toEqual({ tasks: 2, habits: 1, goals: 1 });
  });

  it('accumulates two goals landing on one day', () => {
    const indicators = createCalendarIndicators(new Map(), new Map(), [
      { id: 'one', title: 'One', progress: 10, targetDate: new Date(2026, 7, 20) },
      { id: 'two', title: 'Two', progress: 20, targetDate: new Date(2026, 7, 20) },
    ]);

    expect(indicators.get('2026-08-20')?.goals).toBe(2);
  });

  it('leaves untouched counts at zero', () => {
    const indicators = createCalendarIndicators(
      new Map(),
      new Map([['2026-08-20', ['Reading']]]),
      [],
    );

    expect(indicators.get('2026-08-20')).toEqual({ tasks: 0, habits: 1, goals: 0 });
  });

  it('returns an empty map when nothing is scheduled', () => {
    expect(createCalendarIndicators(new Map(), new Map(), []).size).toBe(0);
  });
});

describe('getIndicatorsForDate', () => {
  it('returns the indicators recorded for that date', () => {
    const indicatorsByDate = new Map([['2026-08-20', { tasks: 2, habits: 1, goals: 0 }]]);

    expect(getIndicatorsForDate(indicatorsByDate, new Date(2026, 7, 20))).toEqual({
      tasks: 2,
      habits: 1,
      goals: 0,
    });
  });

  it('falls back to zeroes for a date with nothing on it', () => {
    expect(getIndicatorsForDate(new Map(), new Date(2026, 7, 20))).toEqual({
      tasks: 0,
      habits: 0,
      goals: 0,
    });
  });
});

describe('countHabitCheckInsInMonth', () => {
  const activity = new Map([
    ['2026-07-31', ['Reading']],
    ['2026-08-01', ['Reading', 'Workout']],
    ['2026-08-20', ['Reading']],
    ['2026-09-01', ['Reading']],
  ]);

  it('counts every check-in inside the month', () => {
    expect(countHabitCheckInsInMonth(activity, new Date(2026, 7, 15))).toBe(3);
  });

  it('excludes the day before the month starts', () => {
    expect(countHabitCheckInsInMonth(activity, new Date(2026, 6, 15))).toBe(1);
  });

  it('is zero for a month with no activity', () => {
    expect(countHabitCheckInsInMonth(activity, new Date(2026, 10, 15))).toBe(0);
  });

  it('is zero for empty activity', () => {
    expect(countHabitCheckInsInMonth(new Map(), new Date(2026, 7, 15))).toBe(0);
  });
});

describe('getDayButtonLabel', () => {
  it('says nothing is scheduled when every count is zero', () => {
    expect(getDayButtonLabel(new Date(2026, 7, 20), { tasks: 0, habits: 0, goals: 0 })).toBe(
      'Thursday, August 20, 2026. No scheduled items',
    );
  });

  it('lists each non-zero count in order', () => {
    expect(getDayButtonLabel(new Date(2026, 7, 20), { tasks: 2, habits: 1, goals: 1 })).toBe(
      'Thursday, August 20, 2026. 2 due tasks. 1 habit check-in. 1 goal target',
    );
  });

  it('omits the categories that are zero', () => {
    expect(getDayButtonLabel(new Date(2026, 7, 20), { tasks: 0, habits: 3, goals: 0 })).toBe(
      'Thursday, August 20, 2026. 3 habit check-ins',
    );
  });
});
```

- [ ] **Step 2: Run the suite**

```sh
pnpm --filter @just-do-it/app exec vitest run src/features/calendar/calendar-selectors.test.ts
```

Expected: PASS. If anything fails, the extraction in Task 1 changed behaviour — fix the **implementation**, not the expectation, after checking the original against `git show HEAD~1:apps/just-do-it/src/routes/calendar-page.tsx`.

- [ ] **Step 3: Run the full gate**

```sh
pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: all green. The repo total rises from 191 to **246** — this suite is 55 tests.

- [ ] **Step 4: Commit**

```bash
git add apps/just-do-it/src/features/calendar/calendar-selectors.test.ts
git commit -m "test(calendar): cover the extracted date mapping"
```

---

### Task 3: Mutation-check the suite

The tests in Task 2 were written against working code and passed on their first run. That proves they execute the code, not that they can fail. **On the previous branch a critical data-loss bug survived 40 tests and a 9-of-9 mutation check**, because no test supplied the input that triggered it. So treat this as a floor, not a ceiling.

**Files:**

- Modify: `apps/just-do-it/src/features/calendar/calendar-selectors.test.ts` (only if a mutation survives)

**Interfaces:**

- Consumes: the module and suite from Tasks 1-2.
- Produces: a suite demonstrated to detect wrong implementations.

- [ ] **Step 1: Back up the module**

```bash
cp apps/just-do-it/src/features/calendar/calendar-selectors.ts /tmp/calendar-selectors.backup.ts
```

- [ ] **Step 2: Apply each mutation, run the suite, restore**

Per mutation: make the edit, run
`pnpm --filter @just-do-it/app exec vitest run src/features/calendar/calendar-selectors.test.ts`,
record CAUGHT or SURVIVED and which test failed, then
`cp /tmp/calendar-selectors.backup.ts apps/just-do-it/src/features/calendar/calendar-selectors.ts`.

| #   | Mutation                                                                                          | Should be caught by                                       |
| --- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | `pluralize`: use the plural when `count === 1`                                                    | "uses the singular for one"                               |
| 2   | `createMonthSelection`: drop the `Math.min` clamp, use `getDate(currentSelection)`                | "clamps to the last day when the target month is shorter" |
| 3   | `createTaskMap`: remove the `if (!task.dueDate) continue` guard                                   | "omits a task with no due date"                           |
| 4   | `createHabitActivityMap`: drop the `.filter(...)` that removes unknown labels                     | "drops a completion whose habit no longer exists"         |
| 5   | `createGoalTargets`: sort descending instead of ascending                                         | "sorts targets by date ascending"                         |
| 6   | `getTaskAgendaTone`: check priority before completed status                                       | "is success for a completed task, even an urgent one"     |
| 7   | `createAgendaItems`: swap `agendaKindOrder` so habit is 0 and task is 2                           | "orders task before goal before habit on the same day"    |
| 8   | `createAgendaItems`: compare kind before date                                                     | "orders by date before kind"                              |
| 9   | `createCalendarIndicators`: overwrite goals with 1 rather than incrementing                       | "accumulates two goals landing on one day"                |
| 10  | `getIndicatorsForDate`: return `undefined` instead of the empty fallback                          | "falls back to zeroes for a date with nothing on it"      |
| 11  | `countHabitCheckInsInMonth`: count days rather than summing labels                                | "counts every check-in inside the month"                  |
| 12  | `getDayButtonLabel`: drop the "No scheduled items" branch                                         | "says nothing is scheduled when every count is zero"      |
| 13  | `createAgendaItems`: drop `now` from the `formatGoalDeadlineLabel` call, restoring the clock read | "describes a goal deadline relative to the injected now"  |

- [ ] **Step 3: Close any gap**

If a mutation SURVIVED, write a test that fails under it, in the existing file's style with a hand-written literal expectation. Re-apply the mutation to confirm the new test catches it, then restore.

- [ ] **Step 4: Confirm the module is back to its committed state**

```bash
git diff --exit-code apps/just-do-it/src/features/calendar/calendar-selectors.ts
```

Expected: no output, exit code 0. If this prints a diff, a mutation was left behind — restore from the backup.

- [ ] **Step 5: Run the full gate and commit if tests were added**

```sh
pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

If Step 3 added tests:

```bash
git add apps/just-do-it/src/features/calendar/calendar-selectors.test.ts
git commit -m "test(calendar): close coverage gaps found by mutation"
```

If no mutation survived, there is nothing to commit. Say so and move on.

---

### Task 4: Record the new module and amend the import rule

**Files:**

- Modify: `CLAUDE.md`
- Modify: `just-do-it-implementation-plan.md`

**Interfaces:**

- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Amend the cross-feature import rule**

`CLAUDE.md` currently says, in the "Data flow" section:

> `src/data/dashboard.ts` is the only cross-domain aggregation point, and it imports _from the feature barrels_ — never the reverse. Features must not import each other's internals; route files compose across features.

`features/calendar` now imports the tasks, habits and goals barrels, so that is no longer accurate. Replace it with:

```markdown
Cross-domain composition has two homes. `src/data/dashboard.ts` aggregates fixtures (and is
currently dead code — nothing imports it). `features/calendar` composes tasks, habits and goals
onto dates, and is the one feature module allowed to import other features. The rule it must obey:
**barrels only, never another feature's internals, and strictly one-way** — no feature imports
`calendar` back, which is what keeps the dependency graph acyclic. Every other feature stays
independent, and route files compose across them.
```

- [ ] **Step 2: Record the new module in the feature-modules section**

`CLAUDE.md` says `features/tasks` and `features/habits` are the only domains with a `components/` subdirectory — that stays true and needs no change. But the same section should note the new module's shape, because it is the first without a store. Add after that bullet:

```markdown
- `features/calendar` is the only domain with **no store and no hooks**. It owns no state — the
  selected month is `useState` in the route — and every export is a pure function over data from
  the other three domains. Its absence of a store is deliberate, not an oversight.
```

- [ ] **Step 3: Update the roadmap**

In `just-do-it-implementation-plan.md`, the Phase 15 checkbox for selector tests currently reads:

```markdown
- [ ] Unit tests for selectors first — `selectTodayTaskSections`, habit streaks and the quick-add
      parser are done; **the calendar mapping is not**, and is the last untested logic of substance
```

The calendar mapping is now done, so tick it and drop the caveat:

```markdown
- [x] Unit tests for selectors — `selectTodayTaskSections`, habit streaks, the quick-add parser
      and the calendar mapping
```

Also update §6's known-debt bullet about test coverage, and the §3 phase-status row for Phase 15, to reflect that the calendar mapping is covered and that the remaining gap is route and component rendering only. **Do not** tick "React Testing Library for Today and Tasks" or "Extend oxlint to `packages/ui`" — both are still undone.

Also update the line in §6 stating `calendar-page.tsx` is ~962 lines; after the extraction it is roughly 730.

- [ ] **Step 4: Verify and commit**

```sh
pnpm format && pnpm format:check
```

```bash
git add CLAUDE.md just-do-it-implementation-plan.md
git commit -m "docs(calendar): record the calendar module and its import carve-out"
```

---

## Final verification

- [ ] `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build` green from the repo root.
- [ ] Every mutation in Task 3 caught.
- [ ] The calendar route renders identically — check by hand at `/calendar`, including switching months, selecting a day, and toggling the day/week agenda. Start the dev server with polling (see Global Constraints).
- [ ] `git log --oneline main..HEAD` shows three or four commits.
- [ ] Push and open a PR against `main`. Branch protection requires the **Verify** check.
