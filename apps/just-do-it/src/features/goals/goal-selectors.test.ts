import { describe, expect, it } from 'vitest';

import { selectPrimaryGoal } from './goal-selectors';
import type { Goal } from './types';

// Inputs are built; every expectation below is a hand-written literal.
function buildGoal(overrides: Partial<Goal> & Pick<Goal, 'id'>): Goal {
  return {
    title: overrides.id,
    description: 'A goal',
    period: 'Monthly focus',
    targetDate: '2026-12-31',
    progress: 0,
    status: 'active',
    ...overrides,
  };
}

describe('selectPrimaryGoal', () => {
  it('returns null for an empty collection', () => {
    expect(selectPrimaryGoal([])).toBeNull();
  });

  it('returns the only goal when there is one', () => {
    const goal = buildGoal({ id: 'solo' });

    expect(selectPrimaryGoal([goal])).toEqual(goal);
  });

  it('prefers an active goal over a paused one with an earlier target date', () => {
    const goals = [
      buildGoal({ id: 'paused-soon', status: 'paused', targetDate: '2026-09-01' }),
      buildGoal({ id: 'active-later', status: 'active', targetDate: '2026-12-01' }),
    ];

    expect(selectPrimaryGoal(goals)?.id).toBe('active-later');
  });

  it('prefers a paused goal over a completed one', () => {
    const goals = [
      buildGoal({ id: 'completed', status: 'completed', progress: 100 }),
      buildGoal({ id: 'paused', status: 'paused' }),
    ];

    expect(selectPrimaryGoal(goals)?.id).toBe('paused');
  });

  it('breaks a status tie by the earlier target date', () => {
    const goals = [
      buildGoal({ id: 'later', targetDate: '2026-12-01' }),
      buildGoal({ id: 'sooner', targetDate: '2026-09-01' }),
    ];

    expect(selectPrimaryGoal(goals)?.id).toBe('sooner');
  });

  it('breaks a target-date tie by the higher progress', () => {
    const goals = [
      buildGoal({ id: 'behind', targetDate: '2026-09-01', progress: 20 }),
      buildGoal({ id: 'ahead', targetDate: '2026-09-01', progress: 80 }),
    ];

    expect(selectPrimaryGoal(goals)?.id).toBe('ahead');
  });

  it('returns a completed goal when it is the only one left', () => {
    const goals = [buildGoal({ id: 'done', status: 'completed', progress: 100 })];

    expect(selectPrimaryGoal(goals)?.id).toBe('done');
  });

  it('leaves the source collection untouched', () => {
    const goals = [
      buildGoal({ id: 'later', targetDate: '2026-12-01' }),
      buildGoal({ id: 'sooner', targetDate: '2026-09-01' }),
    ];

    selectPrimaryGoal(goals);

    expect(goals.map((goal) => goal.id)).toEqual(['later', 'sooner']);
  });
});
