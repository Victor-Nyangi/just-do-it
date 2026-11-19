import type { JourneyCompletion, JourneyEnrollment } from '../journeys';

export type SyncedState = {
  enrollments: JourneyEnrollment[];
  completions: JourneyCompletion[];
};

export const SYNC_STATUS_VALUES = ['local', 'loading', 'synced', 'failed'] as const;

export type SyncStatus = (typeof SYNC_STATUS_VALUES)[number];

export type SyncSnapshot = {
  status: SyncStatus;
  // Set only when status is 'failed', and written for a person to read.
  error: string | null;
};

// What a restart actually did. A restart is two steps — start the new run, then
// remove the old one — and the order means a failure can only ever leave one
// extra run behind, never lose the journey. The caller needs to tell those
// apart, so this is a result rather than a bare id.
export type JourneyRestartResult =
  // The new run exists and the old one, with its ticks, is gone.
  | { status: 'restarted'; enrollmentId: string }
  // Nothing changed: the old run could not be found, or the new one could not
  // be created.
  | { status: 'not-restarted' }
  // The new run exists, but the server would not remove the old one, so both
  // are still there. The person can leave the old one by hand.
  | { status: 'old-run-kept'; enrollmentId: string };
