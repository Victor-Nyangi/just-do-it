import { create } from 'zustand';

import { getInitialGoals, goalSchema } from './goal-data';
import type { Goal, GoalInput, GoalStatus, GoalUpdateInput } from './types';

type GoalStoreState = {
  goals: Goal[];
  createGoal: (input: GoalInput) => void;
  updateGoal: (goalId: string, input: GoalUpdateInput) => void;
  updateGoalProgress: (goalId: string, progress: number) => void;
  updateGoalStatus: (goalId: string, status: GoalStatus) => void;
};

function normalizeGoalProgress(progress: number): number {
  return Math.max(0, Math.min(100, Math.round(progress)));
}

function buildGoalRecord(
  goalId: string,
  input: GoalInput | GoalUpdateInput,
  existingGoal?: Goal,
): Goal {
  const draft = {
    ...existingGoal,
    ...input,
  };

  let progress = normalizeGoalProgress(draft.progress ?? 0);
  let status = draft.status ?? 'active';

  if (status === 'completed') {
    progress = 100;
  } else if (progress >= 100) {
    status = 'completed';
  } else if (
    existingGoal?.status === 'completed' &&
    input.progress !== undefined &&
    input.status === undefined
  ) {
    status = 'active';
  }

  return goalSchema.parse({
    id: existingGoal?.id ?? goalId,
    title: (draft.title ?? '').trim(),
    description: (draft.description ?? '').trim(),
    period: (draft.period ?? '').trim(),
    targetDate: (draft.targetDate ?? '').trim(),
    progress,
    status,
  });
}

export const useGoalStore = create<GoalStoreState>()((set) => ({
  goals: getInitialGoals(),
  createGoal: (input) => {
    set((state) => ({
      goals: [...state.goals, buildGoalRecord(crypto.randomUUID(), input)],
    }));
  },
  updateGoal: (goalId, input) => {
    set((state) => ({
      goals: state.goals.map((goal) =>
        goal.id === goalId ? buildGoalRecord(goalId, input, goal) : goal,
      ),
    }));
  },
  updateGoalProgress: (goalId, progress) => {
    set((state) => ({
      goals: state.goals.map((goal) =>
        goal.id === goalId ? buildGoalRecord(goalId, { progress }, goal) : goal,
      ),
    }));
  },
  updateGoalStatus: (goalId, status) => {
    set((state) => ({
      goals: state.goals.map((goal) =>
        goal.id === goalId ? buildGoalRecord(goalId, { status }, goal) : goal,
      ),
    }));
  },
}));
