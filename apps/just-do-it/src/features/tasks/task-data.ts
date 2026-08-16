import { z } from 'zod'

import tasksFixture from '../../data/tasks.json'
import {
  TASK_CATEGORY_VALUES,
  TASK_PRIORITY_VALUES,
  TASK_RECURRENCE_VALUES,
  TASK_STATUS_VALUES,
  type Task,
  type TaskEditorValues,
  type TaskInput,
} from './types'

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'Expected ISO date')
const isoDateTimeSchema = z.string().datetime({ offset: true })

export const taskSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  status: z.enum(TASK_STATUS_VALUES),
  priority: z.enum(TASK_PRIORITY_VALUES),
  category: z.enum(TASK_CATEGORY_VALUES),
  dueDate: isoDateSchema.optional(),
  completedAt: isoDateTimeSchema.optional(),
  recurrence: z.enum(TASK_RECURRENCE_VALUES),
  recurrenceInterval: z.number().int().positive(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})

export const taskListSchema = z.array(taskSchema)

export const defaultTaskEditorValues: TaskEditorValues = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  category: 'Personal',
  dueDate: '',
  recurrence: 'none',
  recurrenceInterval: 1,
}

const validatedTaskFixture = taskListSchema.parse(tasksFixture)

export function getInitialTasks(): Task[] {
  return validatedTaskFixture.map((task) => ({ ...task }))
}

export function cloneTask(task: Task): Task {
  return { ...task }
}

export function toTaskEditorValues(task: Task): TaskEditorValues {
  return {
    title: task.title,
    description: task.description ?? '',
    status: task.status,
    priority: task.priority,
    category: task.category,
    dueDate: task.dueDate ?? '',
    recurrence: task.recurrence,
    recurrenceInterval: task.recurrenceInterval,
  }
}

export function toTaskInput(values: TaskEditorValues): TaskInput {
  const title = values.title.trim()
  const description = values.description.trim()
  const dueDate = values.dueDate.trim()

  return {
    title,
    description: description || undefined,
    status: values.status,
    priority: values.priority,
    category: values.category,
    dueDate: dueDate || undefined,
    recurrence: values.recurrence,
    recurrenceInterval: values.recurrence === 'none' ? 1 : Math.max(1, values.recurrenceInterval),
  }
}

export { validatedTaskFixture }
