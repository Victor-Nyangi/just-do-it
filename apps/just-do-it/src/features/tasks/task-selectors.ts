import { compareAsc, isBefore, isSameDay, parseISO, startOfDay } from 'date-fns';

import type { Task, TaskFilters, TaskPriority } from './types';

export type TodayTaskSectionKey = 'overdue' | 'today' | 'unscheduled';

export type TodayTaskSection = {
  key: TodayTaskSectionKey;
  tasks: Task[];
};

const statusOrder = {
  in_progress: 0,
  todo: 1,
  completed: 2,
} as const;

const priorityOrder: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function getTaskDateValue(task: Task): Date | null {
  return task.dueDate ? parseISO(task.dueDate) : null;
}

function sortTasks(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((leftTask, rightTask) => {
    const statusDifference = statusOrder[leftTask.status] - statusOrder[rightTask.status];
    if (statusDifference !== 0) return statusDifference;

    const leftDueDate = getTaskDateValue(leftTask);
    const rightDueDate = getTaskDateValue(rightTask);

    if (leftDueDate && rightDueDate) {
      const dueDateDifference = compareAsc(leftDueDate, rightDueDate);
      if (dueDateDifference !== 0) return dueDateDifference;
    } else if (leftDueDate || rightDueDate) {
      return leftDueDate ? -1 : 1;
    }

    const priorityDifference = priorityOrder[leftTask.priority] - priorityOrder[rightTask.priority];
    if (priorityDifference !== 0) return priorityDifference;

    return leftTask.title.localeCompare(rightTask.title);
  });
}

function matchesFilters(task: Task, filters: TaskFilters): boolean {
  const matchesPriority = filters.priority === 'all' || task.priority === filters.priority;
  const matchesCategory = filters.category === 'all' || task.category === filters.category;

  return matchesPriority && matchesCategory;
}

function getTodaySectionKey(task: Task, now: Date): TodayTaskSectionKey | null {
  if (task.status === 'completed') return null;
  if (!task.dueDate) return 'unscheduled';

  const dueDate = parseISO(task.dueDate);

  if (isBefore(dueDate, startOfDay(now))) return 'overdue';
  if (isSameDay(dueDate, now)) return 'today';

  return null;
}

function sortTodaySectionTasks(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((leftTask, rightTask) => {
    const statusDifference = statusOrder[leftTask.status] - statusOrder[rightTask.status];
    if (statusDifference !== 0) return statusDifference;

    const priorityDifference = priorityOrder[leftTask.priority] - priorityOrder[rightTask.priority];
    if (priorityDifference !== 0) return priorityDifference;

    const leftDueDate = getTaskDateValue(leftTask);
    const rightDueDate = getTaskDateValue(rightTask);

    if (leftDueDate && rightDueDate) {
      const dueDateDifference = compareAsc(leftDueDate, rightDueDate);
      if (dueDateDifference !== 0) return dueDateDifference;
    } else if (leftDueDate || rightDueDate) {
      return leftDueDate ? -1 : 1;
    }

    return leftTask.title.localeCompare(rightTask.title);
  });
}

export function selectFilteredTasks(tasks: readonly Task[], filters: TaskFilters): Task[] {
  return sortTasks(tasks.filter((task) => matchesFilters(task, filters)));
}

export function selectActiveTaskCount(tasks: readonly Task[]): number {
  return tasks.filter((task) => task.status !== 'completed').length;
}

export function selectCompletedTaskCount(tasks: readonly Task[]): number {
  return tasks.filter((task) => task.status === 'completed').length;
}

export function selectTodayTaskSections(
  tasks: readonly Task[],
  now = new Date(),
): TodayTaskSection[] {
  const groupedTasks: Record<TodayTaskSectionKey, Task[]> = {
    overdue: [],
    today: [],
    unscheduled: [],
  };

  for (const task of tasks) {
    const sectionKey = getTodaySectionKey(task, now);

    if (!sectionKey) continue;

    groupedTasks[sectionKey].push(task);
  }

  return [
    { key: 'overdue', tasks: sortTodaySectionTasks(groupedTasks.overdue) },
    { key: 'today', tasks: sortTodaySectionTasks(groupedTasks.today) },
    { key: 'unscheduled', tasks: sortTodaySectionTasks(groupedTasks.unscheduled) },
  ];
}

export function selectVisibleTodayTasks(tasks: readonly Task[], now = new Date()): Task[] {
  return selectTodayTaskSections(tasks, now).flatMap((section) => section.tasks);
}

export function selectScheduledTaskCount(tasks: readonly Task[]): number {
  return tasks.filter((task) => task.status !== 'completed' && Boolean(task.dueDate)).length;
}

export function selectRecurringTaskCount(tasks: readonly Task[]): number {
  return tasks.filter((task) => task.recurrence !== 'none').length;
}
