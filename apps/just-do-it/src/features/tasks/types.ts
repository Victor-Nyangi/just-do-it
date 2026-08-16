export const TASK_STATUS_VALUES = ['todo', 'in_progress', 'completed'] as const
export const TASK_PRIORITY_VALUES = ['low', 'medium', 'high', 'urgent'] as const
export const TASK_CATEGORY_VALUES = [
  'Personal',
  'Workout',
  'Reading',
  'Hobby',
  'Errand',
  'Other',
] as const
export const TASK_RECURRENCE_VALUES = ['none', 'daily', 'weekly', 'monthly'] as const

export type TaskStatus = (typeof TASK_STATUS_VALUES)[number]
export type TaskPriority = (typeof TASK_PRIORITY_VALUES)[number]
export type TaskCategory = (typeof TASK_CATEGORY_VALUES)[number]
export type TaskRecurrence = (typeof TASK_RECURRENCE_VALUES)[number]

export type Task = {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  category: TaskCategory
  dueDate?: string
  completedAt?: string
  recurrence: TaskRecurrence
  recurrenceInterval: number
  createdAt: string
  updatedAt: string
}

export type TaskInput = {
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  category: TaskCategory
  dueDate?: string
  recurrence: TaskRecurrence
  recurrenceInterval: number
}

export type TaskEditorValues = {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  category: TaskCategory
  dueDate: string
  recurrence: TaskRecurrence
  recurrenceInterval: number
}

export type TaskFilterValue<TValue extends string> = TValue | 'all'

export type TaskFilters = {
  priority: TaskFilterValue<TaskPriority>
  category: TaskFilterValue<TaskCategory>
}
