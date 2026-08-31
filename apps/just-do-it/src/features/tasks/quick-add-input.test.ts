import { describe, expect, it } from 'vitest';

import { toQuickAddTaskInput } from './quick-add-input';

describe('toQuickAddTaskInput', () => {
  it('carries every parsed field through', () => {
    expect(
      toQuickAddTaskInput({
        title: 'Read 20 pages',
        dueDate: '2026-08-28',
        category: 'Reading',
        priority: 'high',
      }),
    ).toMatchObject({
      title: 'Read 20 pages',
      dueDate: '2026-08-28',
      category: 'Reading',
      priority: 'high',
      status: 'todo',
    });
  });

  // The parser omits absent fields rather than defaulting them, so that
  // `'dueDate' in result` stays meaningful. Supplying the defaults is this
  // function's whole job.
  it('applies the todo/medium/Personal defaults to a bare title', () => {
    const input = toQuickAddTaskInput({ title: 'Water the plants' });

    expect(input).toMatchObject({
      title: 'Water the plants',
      status: 'todo',
      priority: 'medium',
      category: 'Personal',
    });
    expect(input.dueDate).toBeUndefined();
  });

  it('defaults recurrence to none with an interval of one', () => {
    expect(toQuickAddTaskInput({ title: 'Water the plants' })).toMatchObject({
      recurrence: 'none',
      recurrenceInterval: 1,
    });
  });
});
