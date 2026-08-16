import type { Goal } from './types'

export function selectPrimaryGoal(goals: readonly Goal[]): Goal | null {
  return goals[0] ?? null
}
