import { create } from 'zustand'

import { getInitialGoals, goalSchema } from './goal-data'
import type { Goal, GoalStatus, GoalUpdateInput } from './types'

type GoalStoreState = {
  goals: Goal[]
  updateGoal: (goalId: string, input: GoalUpdateInput) => void
  updateGoalProgress: (goalId: string, progress: number) => void
  updateGoalStatus: (goalId: string, status: GoalStatus) => void
}

function normalizeGoalProgress(progress: number): number {
  return Math.max(0, Math.min(100, progress))
}

function buildGoalRecord(goal: Goal, input: GoalUpdateInput): Goal {
  return goalSchema.parse({
    ...goal,
    ...input,
    progress:
      input.progress === undefined ? goal.progress : normalizeGoalProgress(input.progress),
  })
}

export const useGoalStore = create<GoalStoreState>()((set) => ({
  goals: getInitialGoals(),
  updateGoal: (goalId, input) => {
    set((state) => ({
      goals: state.goals.map((goal) =>
        goal.id === goalId ? buildGoalRecord(goal, input) : goal,
      ),
    }))
  },
  updateGoalProgress: (goalId, progress) => {
    set((state) => ({
      goals: state.goals.map((goal) =>
        goal.id === goalId ? buildGoalRecord(goal, { progress }) : goal,
      ),
    }))
  },
  updateGoalStatus: (goalId, status) => {
    set((state) => ({
      goals: state.goals.map((goal) =>
        goal.id === goalId ? buildGoalRecord(goal, { status }) : goal,
      ),
    }))
  },
}))
