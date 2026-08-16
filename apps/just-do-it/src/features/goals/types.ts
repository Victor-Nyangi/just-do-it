export const GOAL_STATUS_VALUES = ['not_started', 'in_progress', 'paused', 'completed'] as const

export type GoalStatus = (typeof GOAL_STATUS_VALUES)[number]

export type Goal = {
  id: string
  title: string
  description: string
  period: string
  progress: number
  remainingLabel: string
  status: GoalStatus
}

export type GoalUpdateInput = Partial<
  Pick<Goal, 'description' | 'period' | 'progress' | 'remainingLabel' | 'status' | 'title'>
>
