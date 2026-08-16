import { selectPrimaryGoal } from './goal-selectors';
import { useGoalStore } from './goal-store';

export function useGoals() {
  return useGoalStore((state) => state.goals);
}

export function usePrimaryGoal() {
  return useGoalStore((state) => selectPrimaryGoal(state.goals));
}

export function useCreateGoal() {
  return useGoalStore((state) => state.createGoal);
}

export function useUpdateGoal() {
  return useGoalStore((state) => state.updateGoal);
}

export function useUpdateGoalProgress() {
  return useGoalStore((state) => state.updateGoalProgress);
}

export function useUpdateGoalStatus() {
  return useGoalStore((state) => state.updateGoalStatus);
}
