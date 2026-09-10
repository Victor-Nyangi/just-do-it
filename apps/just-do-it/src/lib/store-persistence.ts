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
 *
 * The probe only proves the FIRST write succeeds. Every write after that goes
 * through zustand's persist middleware directly (`api.setState` calls
 * `storage.setItem` on every mutation), and `createJSONStorage`'s `setItem` has
 * no try/catch of its own -- so a later QuotaExceededError (the store simply
 * grows past the origin's quota) would otherwise propagate out of a store
 * action, uncaught, into a React event handler. The object returned here wraps
 * `setItem` so a write failure degrades to the in-memory fallback instead of
 * crashing the app, and stays degraded for the rest of the session rather than
 * re-attempting a failing write on every keystroke. `getItem`/`removeItem` are
 * unaffected -- they keep talking to `localStorage` exactly as before.
 */
export function getStorage(): StateStorage {
  try {
    if (typeof localStorage === 'undefined') return memoryStorage;
    const probeKey = `${PERSIST_KEY_PREFIX}__probe`;
    localStorage.setItem(probeKey, '1');
    localStorage.removeItem(probeKey);
  } catch {
    return memoryStorage;
  }

  let degraded = false;

  return {
    getItem: (name) => localStorage.getItem(name),
    setItem: (name, value) => {
      if (degraded) {
        memoryStorage.setItem(name, value);
        return;
      }
      try {
        localStorage.setItem(name, value);
      } catch {
        degraded = true;
        memoryStorage.setItem(name, value);
      }
    },
    removeItem: (name) => localStorage.removeItem(name),
  };
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
 *
 * The fallback is otherwise silent, and that is its own hazard: if a zod schema
 * changes and PERSIST_VERSION is not bumped, every user's persisted state starts
 * failing `validate` and every session quietly reverts to the fixture -- with
 * zustand's write-through then overwriting their real data on the very next
 * mutation. `storeName` exists so the one console.warn this emits per fallback
 * actually tells a developer which store rejected what it was given, rather than
 * just "something, somewhere, went back to demo data." The warn is skipped when
 * there was nothing persisted at all (a genuinely empty key, e.g. a brand-new
 * visitor) -- that is not a rejection, so it does not deserve a log line.
 */
export function createValidatedMerge<T extends object>(
  validate: (persisted: unknown) => Partial<T> | null,
  storeName: string,
) {
  return (persisted: unknown, current: T): T => {
    let valid: Partial<T> | null;
    let thrown: unknown;
    try {
      valid = validate(persisted);
    } catch (error) {
      valid = null;
      thrown = error;
    }

    if (valid) return { ...current, ...valid };

    // `persisted === undefined` (and nothing thrown) means storage genuinely had
    // nothing under this key -- the ordinary first-visit case, and the common
    // case in tests that clear storage. That is not a rejection; there was
    // nothing to reject, so it does not warrant a 2am page. Only warn when
    // there WAS something (even an explicit `null`, e.g. from a version
    // mismatch routed through `migrate: () => null`) and it failed validation,
    // or when `validate` itself threw.
    if (thrown === undefined && persisted === undefined) return current;

    const reason =
      thrown !== undefined
        ? `the validator threw (${thrown instanceof Error ? thrown.message : String(thrown)})`
        : 'the validator rejected it';
    console.warn(
      `[store-persistence] ${storeName}: persisted state was rejected (${reason}) and the ` +
        'seed fixture was used instead. If this was not expected, check whether a schema ' +
        'changed without bumping PERSIST_VERSION -- the next write will overwrite the ' +
        "persisted data with the fixture, so this is worth chasing down before it's gone.",
    );
    return current;
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
