import { compareAsc, parseISO } from 'date-fns';

import type { Goal } from './types';

const goalStatusOrder = {
  active: 0,
  paused: 1,
  completed: 2,
} as const;

export function selectPrimaryGoal(goals: readonly Goal[]): Goal | null {
  return (
    [...goals].sort((leftGoal, rightGoal) => {
      const statusComparison = goalStatusOrder[leftGoal.status] - goalStatusOrder[rightGoal.status];

      if (statusComparison !== 0) return statusComparison;

      const targetDateComparison = compareAsc(
        parseISO(leftGoal.targetDate),
        parseISO(rightGoal.targetDate),
      );

      if (targetDateComparison !== 0) return targetDateComparison;

      return rightGoal.progress - leftGoal.progress;
    })[0] ?? null
  );
}
