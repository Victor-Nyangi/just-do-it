export const GOAL_STATUS_VALUES = ['active', 'paused', 'completed'] as const;

export type GoalStatus = (typeof GOAL_STATUS_VALUES)[number];

export type Goal = {
  id: string;
  title: string;
  description: string;
  period: string;
  targetDate: string;
  progress: number;
  status: GoalStatus;
};

export type GoalInput = Omit<Goal, 'id'>;

export type GoalEditorValues = {
  title: string;
  description: string;
  period: string;
  targetDate: string;
  progress: number;
  status: GoalStatus;
};

export type GoalUpdateInput = Partial<GoalInput>;
