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

  it('carries the day across a year boundary', () => {
    const selection = createMonthSelection(new Date(2026, 11, 31), new Date(2027, 0, 1));

    expect(toIsoDateKey(selection)).toBe('2027-01-31');
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

  it('appends three or more tasks on one date', () => {
    const tasks = [
      buildTask({ id: 'alpha', dueDate: '2026-08-20' }),
      buildTask({ id: 'bravo', dueDate: '2026-08-20' }),
      buildTask({ id: 'charlie', dueDate: '2026-08-20' }),
    ];

    const tasksByDate = createTaskMap(tasks);

    expect(tasksByDate.get('2026-08-20')?.map((task) => task.id)).toEqual([
      'alpha',
      'bravo',
      'charlie',
    ]);
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

  it('drops all completions when every orphan habit spans multiple dates', () => {
    const completions = [
      buildCompletion('deleted-habit', '2026-08-20'),
      buildCompletion('deleted-habit', '2026-08-21'),
    ];

    expect(createHabitActivityMap(habits, completions).size).toBe(0);
  });

  it('does not include a habit with no completions', () => {
    const completions = [buildCompletion('reading', '2026-08-20')];
    const activity = createHabitActivityMap(habits, completions);

    expect(activity.has('2026-08-20')).toBe(true);
    expect(activity.get('2026-08-20')).toEqual(['Reading']);
    expect(activity.has('2026-08-21')).toBe(false);
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

  it('preserves input order for goals with the same targetDate', () => {
    const goals = [
      buildGoal({ id: 'first-tie', targetDate: '2026-08-20' }),
      buildGoal({ id: 'second-tie', targetDate: '2026-08-20' }),
    ];

    expect(createGoalTargets(goals).map((target) => target.id)).toEqual([
      'first-tie',
      'second-tie',
    ]);
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
    ['2025-08-20', ['Reading']],
    ['2026-07-31', ['Reading']],
    ['2026-08-01', ['Reading', 'Workout']],
    ['2026-08-20', ['Reading']],
    ['2026-09-01', ['Reading']],
  ]);

  it('counts every check-in inside the month', () => {
    expect(countHabitCheckInsInMonth(activity, new Date(2026, 7, 15))).toBe(3);
  });

  it('does not conflate the same month in a different year', () => {
    expect(countHabitCheckInsInMonth(activity, new Date(2025, 7, 15))).toBe(1);
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

  it('counts check-ins across a leap-year February boundary', () => {
    const leapYearActivity = new Map([
      ['2028-02-29', ['Reading', 'Workout']],
      ['2028-03-01', ['Reading']],
    ]);

    expect(countHabitCheckInsInMonth(leapYearActivity, new Date(2028, 1, 15))).toBe(2);
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

  it('handles exactly two non-zero categories', () => {
    expect(getDayButtonLabel(new Date(2026, 7, 20), { tasks: 2, habits: 0, goals: 1 })).toBe(
      'Thursday, August 20, 2026. 2 due tasks. 1 goal target',
    );
  });

  it('says nothing about the month unless asked to', () => {
    expect(getDayButtonLabel(new Date(2026, 7, 20), { tasks: 0, habits: 0, goals: 0 })).not.toMatch(
      /Outside this month/u,
    );
  });

  it('marks a day outside the visible month, after the counts', () => {
    expect(getDayButtonLabel(new Date(2026, 7, 20), { tasks: 2, habits: 0, goals: 0 }, true)).toBe(
      'Thursday, August 20, 2026. 2 due tasks. Outside this month',
    );
  });

  it('marks an empty day outside the visible month too', () => {
    expect(getDayButtonLabel(new Date(2026, 7, 20), { tasks: 0, habits: 0, goals: 0 }, true)).toBe(
      'Thursday, August 20, 2026. No scheduled items. Outside this month',
    );
  });
});
