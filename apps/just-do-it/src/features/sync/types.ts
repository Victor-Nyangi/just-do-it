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
