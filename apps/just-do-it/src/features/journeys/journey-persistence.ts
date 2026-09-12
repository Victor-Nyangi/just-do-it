import {
  getInitialJourneyCompletions,
  getInitialJourneyEnrollments,
  getInitialJourneys,
  journeyCollectionSchema,
  journeyCompletionCollectionSchema,
  journeyEnrollmentCollectionSchema,
} from './journey-data';
import type { Journey, JourneyCompletion, JourneyEnrollment } from './types';

// Journeys are the one domain that persists, and the reason is that a hundred
// day challenge is worthless if ticking a box does not survive a reload. Every
// other domain in this app stays session-local by design — see CLAUDE.md.
//
// What persists here is only what a *person* did: their enrollments, their
// completions, and any journey they created in the app. The journey definitions
// that ship in `src/data/journeys.json` are deliberately NOT persisted, so that
// editing the committed fixture still reaches a browser that has already stored
// state. The repo stays the source of truth for what a journey *is*; storage
// only remembers what has been done about it.

const STORAGE_KEY = 'just-do-it:journeys:v1';

export type PersistedJourneyState = {
  journeys: Journey[];
  enrollments: JourneyEnrollment[];
  completions: JourneyCompletion[];
};

// localStorage is absent under the node test environment and can throw outright
// in a private window or with site data blocked. Neither may take the app down,
// so every access goes through these two.
function readStorage(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;

    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(value: string): void {
  try {
    if (typeof localStorage === 'undefined') return;

    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // A full quota or a blocked store means this session simply does not
    // persist. That is worth degrading to, not crashing over.
  }
}

export function clearPersistedJourneyState(): void {
  try {
    if (typeof localStorage === 'undefined') return;

    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Same reasoning as writeStorage.
  }
}

// Stored state is untrusted input like any fixture: it was written by an older
// version of this code, and may have been edited by hand in devtools. It goes
// through the same schemas, and anything that fails validation is discarded
// rather than half-applied.
function parsePersistedState(raw: string): PersistedJourneyState | null {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== 'object' || parsed === null) return null;

    const candidate = parsed as Record<string, unknown>;
    const journeys = journeyCollectionSchema.safeParse(candidate.journeys ?? []);
    const enrollments = journeyEnrollmentCollectionSchema.safeParse(candidate.enrollments ?? []);
    const completions = journeyCompletionCollectionSchema.safeParse(candidate.completions ?? []);

    if (!journeys.success || !enrollments.success || !completions.success) return null;

    return {
      journeys: journeys.data,
      enrollments: enrollments.data,
      completions: completions.data,
    };
  } catch {
    return null;
  }
}

export function loadPersistedJourneyState(): PersistedJourneyState | null {
  const raw = readStorage();

  return raw === null ? null : parsePersistedState(raw);
}

export function savePersistedJourneyState(state: PersistedJourneyState): void {
  const fixtureJourneyIds = new Set(getInitialJourneys().map((journey) => journey.id));

  writeStorage(
    JSON.stringify({
      // Only journeys the user made. A fixture journey is defined by the repo,
      // so storing a copy would freeze whatever shape it had the day it was
      // first seen.
      journeys: state.journeys.filter((journey) => !fixtureJourneyIds.has(journey.id)),
      enrollments: state.enrollments,
      completions: state.completions,
    }),
  );
}

// The fixture is authoritative for journey definitions; storage is
// authoritative for what has been done. Merging that way is what lets a commit
// to `journeys.json` reach a browser that already has state.
export function buildInitialJourneyState(): PersistedJourneyState {
  const fixtureJourneys = getInitialJourneys();
  const persisted = loadPersistedJourneyState();

  if (!persisted) {
    return {
      journeys: fixtureJourneys,
      enrollments: getInitialJourneyEnrollments(),
      completions: getInitialJourneyCompletions(),
    };
  }

  const fixtureJourneyIds = new Set(fixtureJourneys.map((journey) => journey.id));

  return {
    journeys: [
      ...fixtureJourneys,
      ...persisted.journeys.filter((journey) => !fixtureJourneyIds.has(journey.id)),
    ],
    // The presence of stored state decides these, not whether they are empty:
    // someone who left every journey must stay left, rather than having the
    // seeded enrollment reappear on the next reload.
    enrollments: persisted.enrollments,
    // A completion whose activity no longer exists — because the committed
    // rotation changed under it — is inert rather than harmful: every count
    // walks the generated plan and checks membership, so an orphan matches
    // nothing. Dropping them here would need all hundred plans built at boot.
    completions: persisted.completions,
  };
}
