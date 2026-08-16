import { differenceInCalendarDays, format, isValid, parseISO, startOfDay } from 'date-fns';
import { z } from 'zod';

import goalsFixture from '../../data/goals.json';
import {
  GOAL_STATUS_VALUES,
  type Goal,
  type GoalEditorValues,
  type GoalInput,
  type GoalStatus,
} from './types';

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'Expected ISO date');

export const goalSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  period: z.string().trim().min(1),
  targetDate: isoDateSchema,
  progress: z.number().int().min(0).max(100),
  status: z.enum(GOAL_STATUS_VALUES),
});

export const goalListSchema = z.array(goalSchema);

export const defaultGoalEditorValues: GoalEditorValues = {
  title: '',
  description: '',
  period: 'Monthly focus',
  targetDate: '',
  progress: 0,
  status: 'active',
};

const validatedGoalFixture = goalListSchema.parse(goalsFixture);

export const validatedGoalData = validatedGoalFixture.map(cloneGoal);

function normalizeGoalProgress(progress: number): number {
  return Math.max(0, Math.min(100, Math.round(progress)));
}

export function cloneGoal(goal: Goal): Goal {
  return { ...goal };
}

export function getInitialGoals(): Goal[] {
  return validatedGoalFixture.map(cloneGoal);
}

export function toGoalInput(values: GoalEditorValues): GoalInput {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    period: values.period.trim(),
    targetDate: values.targetDate.trim(),
    progress: normalizeGoalProgress(values.progress),
    status: values.status,
  };
}

export function formatGoalDeadlineLabel(targetDate: string, anchorDate = new Date()): string {
  const parsedTargetDate = parseISO(targetDate);

  if (!isValid(parsedTargetDate)) return 'Target date unavailable';

  const dayDifference = differenceInCalendarDays(
    startOfDay(parsedTargetDate),
    startOfDay(anchorDate),
  );

  if (dayDifference < 0) {
    const overdueDays = Math.abs(dayDifference);

    return `${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue`;
  }

  if (dayDifference === 0) return 'Due today';
  if (dayDifference === 1) return 'Due tomorrow';

  return `${dayDifference} days left`;
}

export function formatGoalStatusLabel(status: GoalStatus): string {
  return status.replace(/\b\w/gu, (character) => character.toUpperCase());
}

export function formatGoalTargetDate(targetDate: string): string {
  const parsedTargetDate = parseISO(targetDate);

  if (!isValid(parsedTargetDate)) return 'Invalid date';

  return format(parsedTargetDate, 'MMM d, yyyy');
}

export { validatedGoalFixture };
