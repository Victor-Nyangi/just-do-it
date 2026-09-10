import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createValidatedMerge,
  getStorage,
  PERSIST_KEY_PREFIX,
  PERSIST_VERSION,
} from './store-persistence';

/**
 * A `Storage` stand-in that throws on `setItem` from a chosen call onward, so
 * both storage-quota scenarios can share one fake:
 *
 * - `failFromCall: 1` throws on the very FIRST setItem -- this is Safari
 *   private mode, where localStorage exists but the write probe itself fails.
 * - `failFromCall: 2` lets the probe (call #1, inside getStorage()) succeed,
 *   then throws starting with the first real write (call #2) -- this is quota
 *   exhaustion after the app has been running a while.
 */
function createThrowingLocalStorage(failFromCall: number) {
  const backing = new Map<string, string>();
  let calls = 0;

  return {
    getItem: vi.fn((key: string) => backing.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      calls += 1;
      if (calls >= failFromCall) {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      }
      backing.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      backing.delete(key);
    }),
    clear: () => backing.clear(),
    key: () => null,
    get length() {
      return backing.size;
    },
  } satisfies Storage;
}

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

  describe('getStorage() write-path guard', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

    afterEach(() => {
      if (originalDescriptor) {
        Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, 'localStorage');
      }
    });

    it('falls back to memory when localStorage throws on the very first write (Safari private mode)', () => {
      const fake = createThrowingLocalStorage(1);
      Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true });

      const storage = getStorage();

      expect(() => storage.setItem('just-do-it:tasks', 'value')).not.toThrow();
      expect(storage.getItem('just-do-it:tasks')).toBe('value');
      // The probe itself is what failed here -- getStorage() never got past it,
      // so the raw fake was never handed back at all.
      expect(fake.setItem).toHaveBeenCalledTimes(1);
    });

    it('does not let a QuotaExceededError after a passing probe escape setItem', () => {
      const fake = createThrowingLocalStorage(2);
      Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true });

      const storage = getStorage();

      // Call #1 was the probe inside getStorage() and succeeded. This is the
      // first REAL write, i.e. call #2 on the fake -- the one that throws.
      expect(() => storage.setItem('just-do-it:tasks', 'first-write')).not.toThrow();
    });

    it('stays degraded after a write failure instead of retrying localStorage on every keystroke', () => {
      const fake = createThrowingLocalStorage(2);
      Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true });

      const storage = getStorage();

      storage.setItem('just-do-it:tasks', 'first-write'); // fails, degrades (fake call #2)
      const callsAfterDegrade = fake.setItem.mock.calls.length;

      storage.setItem('just-do-it:tasks', 'second-write');
      storage.setItem('just-do-it:tasks', 'third-write');

      // Once degraded, further writes go straight to the memory fallback --
      // they must not re-invoke the failing real localStorage.setItem.
      expect(fake.setItem).toHaveBeenCalledTimes(callsAfterDegrade);
    });
  });

  it('merges persisted state when validation passes', () => {
    type State = { items: string[]; other: number };
    const merge = createValidatedMerge<State>((persisted) => {
      const items = (persisted as { items?: unknown })?.items;
      return Array.isArray(items) ? { items: items as string[] } : null;
    }, 'test-store');

    const result = merge({ items: ['stored'] }, { items: ['seed'], other: 7 });
    expect(result).toEqual({ items: ['stored'], other: 7 });
  });

  describe('fallback logging', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('falls back to current state when validation fails, and warns once naming the store', () => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      type State = { items: string[] };
      const merge = createValidatedMerge<State>(() => null, 'test-store');

      expect(merge({ items: 'corrupt' }, { items: ['seed'] })).toEqual({ items: ['seed'] });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('test-store');
    });

    it('falls back when persisted state is null, and warns', () => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      type State = { items: string[] };
      const merge = createValidatedMerge<State>(
        (p) => (p === null ? null : { items: [] }),
        'test-store',
      );

      expect(merge(null, { items: ['seed'] })).toEqual({ items: ['seed'] });
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('falls back to current state when validate throws, warns once, and never propagates the error', () => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      type State = { items: string[] };
      const merge = createValidatedMerge<State>(() => {
        throw new Error('validator exploded');
      }, 'test-store');

      expect(() => merge({ items: ['stored'] }, { items: ['seed'] })).not.toThrow();
      expect(merge({ items: ['stored'] }, { items: ['seed'] })).toEqual({ items: ['seed'] });
      // Two merge() calls above -> one warn each.
      expect(warnSpy).toHaveBeenCalledTimes(2);
      expect(warnSpy.mock.calls[0][0]).toContain('test-store');
      expect(warnSpy.mock.calls[0][0]).toContain('validator exploded');
    });
  });
});
