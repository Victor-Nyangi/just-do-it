import { describe, expect, it } from 'vitest';

import {
  selectActiveTaskCount,
  selectCompletedTaskCount,
  selectFilteredTasks,
  selectRecurringTaskCount,
  selectScheduledTaskCount,
  selectTodayTaskSections,
  selectVisibleTodayTasks,
} from './task-selectors';
import type { Task, TaskFilters } from './types';

const now = new Date(2026, 7, 18); // Tuesday 2026-08-18, local time

const allFilters: TaskFilters = { priority: 'all', category: 'all' };

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

function idsOf(tasks: readonly Task[]): string[] {
  return tasks.map((task) => task.id);
}

describe('selectFilteredTasks — ordering', () => {
  it('orders by status before anything else', () => {
    const tasks = [
      buildTask({ id: 'completed-urgent-early', status: 'completed', priority: 'urgent' }),
      buildTask({ id: 'todo-low-late', priority: 'low' }),
      buildTask({ id: 'in-progress-low-late', status: 'in_progress', priority: 'low' }),
    ];

    expect(idsOf(selectFilteredTasks(tasks, allFilters))).toEqual([
      'in-progress-low-late',
      'todo-low-late',
      'completed-urgent-early',
    ]);
  });

  it('orders by due date ascending within a status', () => {
    const tasks = [
      buildTask({ id: 'later', dueDate: '2026-08-20' }),
      buildTask({ id: 'earlier', dueDate: '2026-08-18' }),
    ];

    expect(idsOf(selectFilteredTasks(tasks, allFilters))).toEqual(['earlier', 'later']);
  });

  it('places a dated task ahead of an undated one regardless of priority', () => {
    const tasks = [
      buildTask({ id: 'undated-urgent', priority: 'urgent' }),
      buildTask({ id: 'dated-low', priority: 'low', dueDate: '2026-08-20' }),
    ];

    expect(idsOf(selectFilteredTasks(tasks, allFilters))).toEqual(['dated-low', 'undated-urgent']);
  });

  it('breaks a due-date tie by priority', () => {
    const tasks = [
      buildTask({ id: 'medium', priority: 'medium', dueDate: '2026-08-18', title: 'Alpha' }),
      buildTask({ id: 'high', priority: 'high', dueDate: '2026-08-18', title: 'Zulu' }),
    ];

    expect(idsOf(selectFilteredTasks(tasks, allFilters))).toEqual(['high', 'medium']);
  });

  it('breaks a priority tie by title', () => {
    const tasks = [
      buildTask({ id: 'zulu', dueDate: '2026-08-18', title: 'Zulu' }),
      buildTask({ id: 'alpha', dueDate: '2026-08-18', title: 'Alpha' }),
    ];

    expect(idsOf(selectFilteredTasks(tasks, allFilters))).toEqual(['alpha', 'zulu']);
  });

  it('leaves the source collection untouched', () => {
    const tasks = [
      buildTask({ id: 'second', title: 'Zulu' }),
      buildTask({ id: 'first', title: 'Alpha' }),
    ];

    selectFilteredTasks(tasks, allFilters);

    expect(idsOf(tasks)).toEqual(['second', 'first']);
  });
});

describe('selectFilteredTasks — filtering', () => {
  const tasks = [
    buildTask({ id: 'urgent-errand', priority: 'urgent', category: 'Errand' }),
    buildTask({ id: 'urgent-personal', priority: 'urgent', category: 'Personal' }),
    buildTask({ id: 'low-errand', priority: 'low', category: 'Errand' }),
  ];

  it('keeps every task when both filters are "all"', () => {
    expect(selectFilteredTasks(tasks, allFilters)).toHaveLength(3);
  });

  it('keeps only the matching priority', () => {
    const filtered = selectFilteredTasks(tasks, { priority: 'urgent', category: 'all' });

    expect(idsOf(filtered)).toEqual(['urgent-errand', 'urgent-personal']);
  });

  it('keeps only the matching category', () => {
    const filtered = selectFilteredTasks(tasks, { priority: 'all', category: 'Errand' });

    expect(idsOf(filtered)).toEqual(['urgent-errand', 'low-errand']);
  });

  it('requires both filters to match at once', () => {
    const filtered = selectFilteredTasks(tasks, { priority: 'low', category: 'Personal' });

    expect(filtered).toEqual([]);
  });
});

describe('task counts', () => {
  const tasks = [
    buildTask({ id: 'todo-dated', dueDate: '2026-08-18' }),
    buildTask({ id: 'in-progress-undated', status: 'in_progress' }),
    buildTask({ id: 'completed-dated', status: 'completed', dueDate: '2026-08-10' }),
    buildTask({ id: 'todo-weekly', recurrence: 'weekly', recurrenceInterval: 2 }),
  ];

  it('counts every task that is not completed as active', () => {
    expect(selectActiveTaskCount(tasks)).toBe(3);
  });

  it('counts completed tasks', () => {
    expect(selectCompletedTaskCount(tasks)).toBe(1);
  });

  it('counts only active tasks that carry a due date as scheduled', () => {
    expect(selectScheduledTaskCount(tasks)).toBe(1);
  });

  it('counts tasks whose recurrence is not "none"', () => {
    expect(selectRecurringTaskCount(tasks)).toBe(1);
  });

  it('returns zero for every count on an empty collection', () => {
    expect(selectActiveTaskCount([])).toBe(0);
    expect(selectCompletedTaskCount([])).toBe(0);
    expect(selectScheduledTaskCount([])).toBe(0);
    expect(selectRecurringTaskCount([])).toBe(0);
  });
});

describe('selectTodayTaskSections — bucketing', () => {
  it('files a past due date under overdue', () => {
    const sections = selectTodayTaskSections(
      [buildTask({ id: 'yesterday', dueDate: '2026-08-17' })],
      now,
    );

    expect(idsOf(sections[0].tasks)).toEqual(['yesterday']);
  });

  it('files a due date matching the injected now under today', () => {
    const sections = selectTodayTaskSections(
      [buildTask({ id: 'due-now', dueDate: '2026-08-18' })],
      now,
    );

    expect(idsOf(sections[1].tasks)).toEqual(['due-now']);
  });

  it('still files a task due today under today once the day is under way', () => {
    // `now` is mid-afternoon, so the overdue boundary has to be the start of the
    // day rather than the current instant — a date-only due date parses to local
    // midnight, which is already behind us.
    const afternoon = new Date(2026, 7, 18, 15, 30);

    const sections = selectTodayTaskSections(
      [buildTask({ id: 'due-now', dueDate: '2026-08-18' })],
      afternoon,
    );

    expect(idsOf(sections[0].tasks)).toEqual([]);
    expect(idsOf(sections[1].tasks)).toEqual(['due-now']);
  });

  it('files a task without a due date under unscheduled', () => {
    const sections = selectTodayTaskSections([buildTask({ id: 'someday' })], now);

    expect(idsOf(sections[2].tasks)).toEqual(['someday']);
  });

  it('drops a future task from every section', () => {
    const sections = selectTodayTaskSections(
      [buildTask({ id: 'tomorrow', dueDate: '2026-08-19' })],
      now,
    );

    expect(sections.flatMap((section) => section.tasks)).toEqual([]);
  });

  it('drops a completed task even when it is overdue', () => {
    const tasks = [buildTask({ id: 'done', status: 'completed', dueDate: '2026-08-10' })];

    expect(selectTodayTaskSections(tasks, now).flatMap((section) => section.tasks)).toEqual([]);
  });

  it('drops a completed task that has no due date', () => {
    const tasks = [buildTask({ id: 'done-undated', status: 'completed' })];

    expect(selectTodayTaskSections(tasks, now).flatMap((section) => section.tasks)).toEqual([]);
  });

  it('always returns the three sections in a fixed order, even when empty', () => {
    const sections = selectTodayTaskSections([], now);

    expect(sections.map((section) => section.key)).toEqual(['overdue', 'today', 'unscheduled']);
    expect(sections.every((section) => section.tasks.length === 0)).toBe(true);
  });
});

describe('selectTodayTaskSections — ordering within a section', () => {
  it('orders by status first', () => {
    const tasks = [
      buildTask({ id: 'todo-urgent', priority: 'urgent', dueDate: '2026-08-01' }),
      buildTask({
        id: 'in-progress-low',
        status: 'in_progress',
        priority: 'low',
        dueDate: '2026-08-17',
      }),
    ];

    expect(idsOf(selectTodayTaskSections(tasks, now)[0].tasks)).toEqual([
      'in-progress-low',
      'todo-urgent',
    ]);
  });

  it('orders by priority ahead of due date — the opposite of the tasks-page ordering', () => {
    const tasks = [
      buildTask({ id: 'low-oldest', priority: 'low', dueDate: '2026-08-01' }),
      buildTask({ id: 'urgent-newest', priority: 'urgent', dueDate: '2026-08-17' }),
    ];

    expect(idsOf(selectTodayTaskSections(tasks, now)[0].tasks)).toEqual([
      'urgent-newest',
      'low-oldest',
    ]);
    // The same two tasks sort the other way round on the tasks page.
    expect(idsOf(selectFilteredTasks(tasks, allFilters))).toEqual(['low-oldest', 'urgent-newest']);
  });

  it('breaks a priority tie by due date', () => {
    const tasks = [
      buildTask({ id: 'later', dueDate: '2026-08-17', title: 'Alpha' }),
      buildTask({ id: 'earlier', dueDate: '2026-08-01', title: 'Zulu' }),
    ];

    expect(idsOf(selectTodayTaskSections(tasks, now)[0].tasks)).toEqual(['earlier', 'later']);
  });

  it('breaks a due-date tie by title', () => {
    const tasks = [
      buildTask({ id: 'zulu', dueDate: '2026-08-17', title: 'Zulu' }),
      buildTask({ id: 'alpha', dueDate: '2026-08-17', title: 'Alpha' }),
    ];

    expect(idsOf(selectTodayTaskSections(tasks, now)[0].tasks)).toEqual(['alpha', 'zulu']);
  });
});

describe('selectVisibleTodayTasks', () => {
  it('flattens the sections in overdue, today, unscheduled order', () => {
    const tasks = [
      buildTask({ id: 'someday' }),
      buildTask({ id: 'due-now', dueDate: '2026-08-18' }),
      buildTask({ id: 'yesterday', dueDate: '2026-08-17' }),
    ];

    expect(idsOf(selectVisibleTodayTasks(tasks, now))).toEqual(['yesterday', 'due-now', 'someday']);
  });

  it('is empty when nothing is due or unscheduled', () => {
    expect(
      selectVisibleTodayTasks([buildTask({ id: 'tomorrow', dueDate: '2026-08-19' })], now),
    ).toEqual([]);
  });
});
