import { compareAsc, isBefore, isToday, parseISO, startOfDay } from 'date-fns'

import type { Task, TaskFilters, TaskPriority } from './types'

const statusOrder = {
  in_progress: 0,
  todo: 1,
  completed: 2,
} as const

const priorityOrder: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function getTaskDateValue(task: Task): Date | null {
  return task.dueDate ? parseISO(task.dueDate) : null
}

function sortTasks(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((leftTask, rightTask) => {
    const statusDifference = statusOrder[leftTask.status] - statusOrder[rightTask.status]
    if (statusDifference !== 0) return statusDifference

    const leftDueDate = getTaskDateValue(leftTask)
    const rightDueDate = getTaskDateValue(rightTask)

    if (leftDueDate && rightDueDate) {
      const dueDateDifference = compareAsc(leftDueDate, rightDueDate)
      if (dueDateDifference !== 0) return dueDateDifference
    } else if (leftDueDate || rightDueDate) {
      return leftDueDate ? -1 : 1
    }

    const priorityDifference = priorityOrder[leftTask.priority] - priorityOrder[rightTask.priority]
    if (priorityDifference !== 0) return priorityDifference

    return leftTask.title.localeCompare(rightTask.title)
  })
}

function matchesFilters(task: Task, filters: TaskFilters): boolean {
  const matchesPriority = filters.priority === 'all' || task.priority === filters.priority
  const matchesCategory = filters.category === 'all' || task.category === filters.category

  return matchesPriority && matchesCategory
}

function getTodayGroup(task: Task, now: Date): number {
  if (!task.dueDate) return 2

  const dueDate = parseISO(task.dueDate)

  if (isBefore(dueDate, startOfDay(now))) return 0
  if (isToday(dueDate)) return 1

  return 3
}

export function selectFilteredTasks(tasks: readonly Task[], filters: TaskFilters): Task[] {
  return sortTasks(tasks.filter((task) => matchesFilters(task, filters)))
}

export function selectActiveTaskCount(tasks: readonly Task[]): number {
  return tasks.filter((task) => task.status !== 'completed').length
}

export function selectCompletedTaskCount(tasks: readonly Task[]): number {
  return tasks.filter((task) => task.status === 'completed').length
}

export function selectVisibleTodayTasks(tasks: readonly Task[], now = new Date()): Task[] {
  return [...tasks]
    .filter((task) => task.status !== 'completed')
    .filter((task) => {
      if (!task.dueDate) return true

      const dueDate = parseISO(task.dueDate)
      return isToday(dueDate) || isBefore(dueDate, startOfDay(now))
    })
    .sort((leftTask, rightTask) => {
      const todayGroupDifference = getTodayGroup(leftTask, now) - getTodayGroup(rightTask, now)
      if (todayGroupDifference !== 0) return todayGroupDifference

      const priorityDifference = priorityOrder[leftTask.priority] - priorityOrder[rightTask.priority]
      if (priorityDifference !== 0) return priorityDifference

      if (leftTask.dueDate && rightTask.dueDate) {
        const dueDateDifference = compareAsc(parseISO(leftTask.dueDate), parseISO(rightTask.dueDate))
        if (dueDateDifference !== 0) return dueDateDifference
      }

      return leftTask.title.localeCompare(rightTask.title)
    })
}

export function selectScheduledTaskCount(tasks: readonly Task[]): number {
  return tasks.filter((task) => task.status !== 'completed' && Boolean(task.dueDate)).length
}

export function selectRecurringTaskCount(tasks: readonly Task[]): number {
  return tasks.filter((task) => task.recurrence !== 'none').length
}
