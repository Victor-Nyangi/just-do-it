import { format, isBefore, isToday, parseISO, startOfDay } from 'date-fns'

import { Badge } from '@just-do-it/ui'
import type { Task } from '../types'

type TaskMetadataProps = {
  task: Task
  showDueDate?: boolean
  showRecurrence?: boolean
}

function getStatusTone(task: Task): 'neutral' | 'accent' | 'success' {
  if (task.status === 'completed') return 'success'
  if (task.status === 'in_progress') return 'accent'
  return 'neutral'
}

function getStatusLabel(task: Task): string {
  if (task.status === 'in_progress') return 'In progress'
  if (task.status === 'completed') return 'Completed'
  return 'To do'
}

function getPriorityTone(task: Task): 'neutral' | 'accent' | 'warning' {
  if (task.priority === 'urgent' || task.priority === 'high') return 'warning'
  if (task.priority === 'medium') return 'accent'
  return 'neutral'
}

function getPriorityLabel(task: Task): string {
  return task.priority.charAt(0).toUpperCase() + task.priority.slice(1)
}

function getDueDateBadge(task: Task): { label: string; tone: 'neutral' | 'accent' | 'warning' } | null {
  if (!task.dueDate) return null

  const dueDate = parseISO(task.dueDate)

  if (isBefore(dueDate, startOfDay(new Date()))) {
    return {
      label: `Overdue · ${format(dueDate, 'MMM d')}`,
      tone: 'warning',
    }
  }

  if (isToday(dueDate)) {
    return {
      label: 'Due today',
      tone: 'accent',
    }
  }

  return {
    label: `Due ${format(dueDate, 'MMM d')}`,
    tone: 'neutral',
  }
}

function getRecurrenceLabel(task: Task): string | null {
  if (task.recurrence === 'none') return null

  const singularCadence = {
    daily: 'day',
    weekly: 'week',
    monthly: 'month',
  } as const

  if (task.recurrenceInterval === 1) {
    return `Every ${singularCadence[task.recurrence]}`
  }

  return `Every ${task.recurrenceInterval} ${task.recurrence}`
}

export function TaskMetadata({ task, showDueDate = true, showRecurrence = true }: TaskMetadataProps) {
  const dueDateBadge = showDueDate ? getDueDateBadge(task) : null
  const recurrenceLabel = showRecurrence ? getRecurrenceLabel(task) : null

  return (
    <div className="flex flex-wrap gap-2">
      <Badge tone={getStatusTone(task)}>{getStatusLabel(task)}</Badge>
      <Badge tone={getPriorityTone(task)}>{getPriorityLabel(task)}</Badge>
      <Badge>{task.category}</Badge>
      {dueDateBadge && <Badge tone={dueDateBadge.tone}>{dueDateBadge.label}</Badge>}
      {recurrenceLabel && <Badge tone="accent">{recurrenceLabel}</Badge>}
    </div>
  )
}
