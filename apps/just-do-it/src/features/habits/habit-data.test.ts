import { describe, expect, it } from 'vitest';

import { habitCompletionCollectionSchema, habitSchema } from './habit-data';

const baseHabit = {
  id: 'reading',
  label: 'Reading',
  frequency: 'weekly' as const,
  target: 4,
  createdAt: '2026-05-25',
  days: [true, true, true, true, true],
};

describe('habitSchema', () => {
  it('accepts a weekly habit with a target above one', () => {
    expect(habitSchema.parse(baseHabit).target).toBe(4);
  });

  it('rejects a daily habit whose target is not one', () => {
    expect(() => habitSchema.parse({ ...baseHabit, frequency: 'daily', target: 3 })).toThrow();
  });

  it('accepts a daily habit with a target of one', () => {
    expect(habitSchema.parse({ ...baseHabit, frequency: 'daily', target: 1 }).frequency).toBe(
      'daily',
    );
  });

  it('rejects a target above seven', () => {
    expect(() => habitSchema.parse({ ...baseHabit, target: 8 })).toThrow();
  });

  it('rejects a target below one', () => {
    expect(() => habitSchema.parse({ ...baseHabit, target: 0 })).toThrow();
  });

  it('rejects a malformed createdAt', () => {
    expect(() => habitSchema.parse({ ...baseHabit, createdAt: '25-05-2026' })).toThrow();
  });

  it('normalizes a blank description to undefined', () => {
    expect(habitSchema.parse({ ...baseHabit, description: '   ' }).description).toBeUndefined();
  });
});

describe('habitCompletionCollectionSchema', () => {
  it('accepts distinct habit and date pairs', () => {
    const completions = [
      { id: 'one', habitId: 'reading', date: '2026-08-17' },
      { id: 'two', habitId: 'reading', date: '2026-08-18' },
      { id: 'three', habitId: 'workout', date: '2026-08-17' },
    ];

    expect(habitCompletionCollectionSchema.parse(completions)).toHaveLength(3);
  });

  it('rejects a duplicate habit and date pair', () => {
    const completions = [
      { id: 'one', habitId: 'reading', date: '2026-08-17' },
      { id: 'two', habitId: 'reading', date: '2026-08-17' },
    ];

    expect(() => habitCompletionCollectionSchema.parse(completions)).toThrow();
  });

  it('rejects a malformed date', () => {
    expect(() =>
      habitCompletionCollectionSchema.parse([{ id: 'one', habitId: 'reading', date: 'yesterday' }]),
    ).toThrow();
  });
});
