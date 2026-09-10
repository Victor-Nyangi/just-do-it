import { describe, expect, it } from 'vitest';

import {
  createValidatedMerge,
  getStorage,
  PERSIST_KEY_PREFIX,
  PERSIST_VERSION,
} from './store-persistence';

describe('store-persistence', () => {
  it('exposes the agreed key prefix and version', () => {
    expect(PERSIST_KEY_PREFIX).toBe('just-do-it:');
    expect(PERSIST_VERSION).toBe(1);
  });

  it('returns a working storage even when localStorage is absent', () => {
    // This suite runs under `environment: node`, where localStorage does not exist.
    const storage = getStorage();
    storage.setItem('just-do-it:probe', 'value');
    expect(storage.getItem('just-do-it:probe')).toBe('value');
    storage.removeItem('just-do-it:probe');
    expect(storage.getItem('just-do-it:probe')).toBeNull();
  });

  it('merges persisted state when validation passes', () => {
    type State = { items: string[]; other: number };
    const merge = createValidatedMerge<State>((persisted) => {
      const items = (persisted as { items?: unknown })?.items;
      return Array.isArray(items) ? { items: items as string[] } : null;
    });

    const result = merge({ items: ['stored'] }, { items: ['seed'], other: 7 });
    expect(result).toEqual({ items: ['stored'], other: 7 });
  });

  it('falls back to current state when validation fails', () => {
    type State = { items: string[] };
    const merge = createValidatedMerge<State>(() => null);
    expect(merge({ items: 'corrupt' }, { items: ['seed'] })).toEqual({ items: ['seed'] });
  });

  it('falls back when persisted state is null', () => {
    type State = { items: string[] };
    const merge = createValidatedMerge<State>((p) => (p === null ? null : { items: [] }));
    expect(merge(null, { items: ['seed'] })).toEqual({ items: ['seed'] });
  });

  it('falls back to current state when validate throws', () => {
    type State = { items: string[] };
    const merge = createValidatedMerge<State>(() => {
      throw new Error('validator exploded');
    });
    expect(() => merge({ items: ['stored'] }, { items: ['seed'] })).not.toThrow();
    expect(merge({ items: ['stored'] }, { items: ['seed'] })).toEqual({ items: ['seed'] });
  });
});
