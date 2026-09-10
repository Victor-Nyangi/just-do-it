import type { StateStorage } from 'zustand/middleware';

/** Every persisted store key starts with this, so tests can clear them as a set. */
export const PERSIST_KEY_PREFIX = 'just-do-it:';

/** Bump when a persisted shape changes. Mismatches fall back to the fixture. */
export const PERSIST_VERSION = 1;

// Used when localStorage is unavailable: the `node` test environment, SSR, or
// Safari private mode (where localStorage EXISTS but setItem throws). Keeping a
// real Map rather than a no-op means a store still behaves correctly in-process.
const memoryFallback = new Map<string, string>();

const memoryStorage: StateStorage = {
  getItem: (name) => memoryFallback.get(name) ?? null,
  setItem: (name, value) => {
    memoryFallback.set(name, value);
  },
  removeItem: (name) => {
    memoryFallback.delete(name);
  },
};

/**
 * Real localStorage when it is present AND writable, memory otherwise.
 *
 * The write probe is not paranoia: Safari private mode exposes localStorage and
 * throws QuotaExceededError on the first setItem, so a `typeof` check alone
 * would hand back a storage that fails at the worst moment.
 */
export function getStorage(): StateStorage {
  try {
    if (typeof localStorage === 'undefined') return memoryStorage;
    const probeKey = `${PERSIST_KEY_PREFIX}__probe`;
    localStorage.setItem(probeKey, '1');
    localStorage.removeItem(probeKey);
    return localStorage;
  } catch {
    return memoryStorage;
  }
}

/**
 * Builds a zustand `merge` that re-validates persisted state before admitting it.
 *
 * CLAUDE.md's invariant is that stores re-parse through buildXRecord() on every
 * mutation, so invalid state cannot be written by feature code. Persisted storage
 * is a NEW, UNTRUSTED input that bypasses that path entirely. `validate` returns
 * null for anything it does not recognise, and we then keep `current` — which is
 * the fixture-seeded initial state. A corrupt store degrades to a working seeded
 * app rather than a white screen.
 *
 * `validate` is also called inside a try/catch: a throwing validator (e.g. a
 * store that uses zod's `.parse()` instead of `.safeParse()`) is treated the
 * same as a `null` return — a rejection, not a crash. This is the enforcement
 * point for "rehydration never throws," so it cannot rely on every future
 * `validate` implementation remembering not to throw.
 */
export function createValidatedMerge<T extends object>(
  validate: (persisted: unknown) => Partial<T> | null,
) {
  return (persisted: unknown, current: T): T => {
    let valid: Partial<T> | null;
    try {
      valid = validate(persisted);
    } catch {
      valid = null;
    }
    return valid ? { ...current, ...valid } : current;
  };
}

/** Test-only: drop every persisted store key. Safe when localStorage is absent. */
export function clearPersistedStores(): void {
  memoryFallback.clear();
  if (typeof localStorage === 'undefined') return;
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(PERSIST_KEY_PREFIX)) localStorage.removeItem(key);
  }
}
