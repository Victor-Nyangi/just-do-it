import { z } from 'zod'

import goalsFixture from '../../data/goals.json'
import { GOAL_STATUS_VALUES, type Goal, type GoalStatus } from './types'

const goalFixtureSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  period: z.string().trim().min(1),
  progress: z.number().min(0).max(100),
  remainingLabel: z.string().trim().min(1),
})

export const goalSchema = goalFixtureSchema.extend({
  status: z.enum(GOAL_STATUS_VALUES),
})

export const goalListSchema = z.array(goalSchema)

const validatedGoalFixture = z.array(goalFixtureSchema).min(1).parse(goalsFixture)

function inferGoalStatus(progress: number): GoalStatus {
  if (progress <= 0) return 'not_started'
  if (progress >= 100) return 'completed'

  return 'in_progress'
}

const validatedGoalData = validatedGoalFixture.map((goal) =>
  goalSchema.parse({
    ...goal,
    status: inferGoalStatus(goal.progress),
  }),
)

export function cloneGoal(goal: Goal): Goal {
  return { ...goal }
}

export function getInitialGoals(): Goal[] {
  return validatedGoalData.map(cloneGoal)
}

export { validatedGoalData, validatedGoalFixture }
