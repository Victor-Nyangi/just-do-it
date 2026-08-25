import { beforeEach, describe, expect, it } from 'vitest';

import { getInitialGoals } from './goal-data';
import { useGoalStore } from './goal-store';
import type { Goal, GoalInput } from './types';

const baseInput: GoalInput = {
  title: 'Read twelve books',
  description: 'One a month',
  period: 'Yearly focus',
  targetDate: '2026-12-31',
  progress: 0,
  status: 'active',
};

function createGoal(overrides: Partial<GoalInput> = {}): Goal {
  useGoalStore.getState().createGoal({ ...baseInput, ...overrides });

  const created = useGoalStore.getState().goals.at(-1);
  if (!created) throw new Error('createGoal did not append a goal');

  return created;
}

function findGoal(goalId: string) {
  return useGoalStore.getState().goals.find((goal) => goal.id === goalId);
}

describe('useGoalStore — createGoal', () => {
  beforeEach(() => {
    useGoalStore.setState({ goals: getInitialGoals() });
  });

  it('appends the new goal without disturbing the existing ones', () => {
    const before = useGoalStore.getState().goals.length;

    const created = createGoal({ title: 'Learn Swahili' });

    expect(useGoalStore.getState().goals).toHaveLength(before + 1);
    expect(created.title).toBe('Learn Swahili');
  });

  it('trims whitespace off the text fields', () => {
    const created = createGoal({
      title: '  Learn Swahili  ',
      description: '  Daily practice  ',
      period: '  Yearly focus  ',
    });

    expect(created.title).toBe('Learn Swahili');
    expect(created.description).toBe('Daily practice');
    expect(created.period).toBe('Yearly focus');
  });

  it('rounds a fractional progress to a whole number', () => {
    expect(createGoal({ progress: 42.6 }).progress).toBe(43);
  });

  it('clamps a negative progress to zero', () => {
    expect(createGoal({ progress: -20 }).progress).toBe(0);
  });

  it('clamps a progress above one hundred and marks the goal completed', () => {
    const created = createGoal({ progress: 150 });

    expect(created.progress).toBe(100);
    expect(created.status).toBe('completed');
  });

  it('gives each goal a distinct id', () => {
    const first = createGoal();
    const second = createGoal();

    expect(first.id).not.toBe(second.id);
  });
});

describe('useGoalStore — progress and status stay in step', () => {
  beforeEach(() => {
    useGoalStore.setState({ goals: getInitialGoals() });
  });

  it('completes a goal that reaches one hundred percent', () => {
    const goal = createGoal({ progress: 40 });

    useGoalStore.getState().updateGoalProgress(goal.id, 100);

    expect(findGoal(goal.id)?.status).toBe('completed');
  });

  it('leaves a goal short of one hundred percent active', () => {
    const goal = createGoal({ progress: 40 });

    useGoalStore.getState().updateGoalProgress(goal.id, 99);

    expect(findGoal(goal.id)?.status).toBe('active');
  });

  it('drives progress to one hundred when the goal is marked completed', () => {
    const goal = createGoal({ progress: 40 });

    useGoalStore.getState().updateGoalStatus(goal.id, 'completed');

    expect(findGoal(goal.id)?.progress).toBe(100);
  });

  it('reopens a completed goal when its progress is lowered', () => {
    const goal = createGoal({ progress: 100 });
    expect(goal.status).toBe('completed');

    useGoalStore.getState().updateGoalProgress(goal.id, 40);

    const reopened = findGoal(goal.id);
    expect(reopened?.progress).toBe(40);
    expect(reopened?.status).toBe('active');
  });

  it('keeps a completed goal completed when the status is restated alongside a lower progress', () => {
    const goal = createGoal({ progress: 100 });

    useGoalStore.getState().updateGoal(goal.id, { progress: 40, status: 'completed' });

    const updated = findGoal(goal.id);
    expect(updated?.status).toBe('completed');
    expect(updated?.progress).toBe(100);
  });

  it('keeps a completed goal completed when an unrelated field is edited', () => {
    const goal = createGoal({ progress: 100 });

    useGoalStore.getState().updateGoal(goal.id, { title: 'Renamed' });

    expect(findGoal(goal.id)?.status).toBe('completed');
  });

  it('keeps a paused goal paused when an unrelated field is edited', () => {
    const goal = createGoal({ progress: 50 });
    useGoalStore.getState().updateGoalStatus(goal.id, 'paused');

    useGoalStore.getState().updateGoal(goal.id, { title: 'Renamed' });

    expect(findGoal(goal.id)?.status).toBe('paused');
  });

  it('pauses a completed goal at one hundred percent when the status is set explicitly', () => {
    const goal = createGoal({ progress: 100 });

    useGoalStore.getState().updateGoalStatus(goal.id, 'paused');

    const paused = findGoal(goal.id);
    expect(paused?.status).toBe('paused');
    expect(paused?.progress).toBe(100);
  });
});

describe('useGoalStore — updateGoal', () => {
  beforeEach(() => {
    useGoalStore.setState({ goals: getInitialGoals() });
  });

  it('keeps the fields a partial update leaves out', () => {
    const goal = createGoal({ title: 'Read twelve books', description: 'One a month' });

    useGoalStore.getState().updateGoal(goal.id, { title: 'Read twenty books' });

    const updated = findGoal(goal.id);
    expect(updated?.title).toBe('Read twenty books');
    expect(updated?.description).toBe('One a month');
    expect(updated?.targetDate).toBe('2026-12-31');
  });

  it('keeps the goal id stable across an update', () => {
    const goal = createGoal();

    useGoalStore.getState().updateGoal(goal.id, { title: 'Renamed' });

    expect(findGoal(goal.id)?.id).toBe(goal.id);
  });

  it('leaves the other goals alone', () => {
    const first = createGoal({ title: 'First' });
    const second = createGoal({ title: 'Second' });

    useGoalStore.getState().updateGoal(first.id, { title: 'First, renamed' });

    expect(findGoal(second.id)?.title).toBe('Second');
  });

  it('rejects an update that would blank a required field', () => {
    const goal = createGoal();

    expect(() => useGoalStore.getState().updateGoal(goal.id, { title: '   ' })).toThrow();
  });
});
