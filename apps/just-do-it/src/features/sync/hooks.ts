import { useCallback, useContext } from 'react';

import { useAuthSnapshot, useAuthTokenGetter } from '../auth';
import { useJourneyStore } from '../journeys';
import { createRemoteEnrollment, deleteRemoteEnrollment, pushToggle } from './sync-client';
import { isApiConfigured } from './sync-config';
import { SyncStatusContext } from './sync-context';
import type { SyncSnapshot } from './types';

export function useSyncStatus(): SyncSnapshot {
  return useContext(SyncStatusContext);
}

// True when this build has an API *and* somebody is signed in. Everything below
// falls back to the purely local action when it is false, which is the
// portfolio-visitor path and the no-key path.
function useIsSyncing(): boolean {
  const auth = useAuthSnapshot();

  return isApiConfigured && auth.loaded && auth.signedIn;
}

// `features/journeys` knows nothing about auth or the API — the dependency runs
// one way, sync -> journeys. These hooks are the composition point, and routes
// use them instead of the raw store actions. A route is allowed to compose
// across features; a feature is not.
export function useSyncedToggleActivity(): (
  enrollmentId: string,
  dayIndex: number,
  activityId: string,
) => void {
  const syncing = useIsSyncing();
  const getToken = useAuthTokenGetter();
  const toggleLocally = useJourneyStore((state) => state.toggleActivityCompletion);

  return useCallback(
    (enrollmentId, dayIndex, activityId) => {
      // Applied locally first, always. A checklist that waited for a round trip
      // before showing a tick would feel broken on a phone, and the server
      // toggle is idempotent on the same triple, so a retry cannot double it.
      toggleLocally(enrollmentId, dayIndex, activityId);

      if (!syncing) return;

      void pushToggle(getToken, enrollmentId, dayIndex, activityId).catch(() => {
        // Deliberately swallowed for now: the local record is still correct and
        // the next hydration reconciles. Surfacing a per-tick error would need
        // somewhere to put it, which is the retry queue this does not yet have.
      });
    },
    [getToken, syncing, toggleLocally],
  );
}

// Enrolment is the one action that cannot be optimistic: the server owns the
// enrollment id, and a completion written against a locally invented one would
// point at nothing once the real id arrived.
export function useSyncedEnrollInJourney(): (
  journeyId: string,
  startDate: string,
) => Promise<string | null> {
  const syncing = useIsSyncing();
  const getToken = useAuthTokenGetter();
  const enrollLocally = useJourneyStore((state) => state.enrollInJourney);
  const adoptEnrollment = useJourneyStore((state) => state.adoptEnrollment);

  return useCallback(
    async (journeyId, startDate) => {
      if (!syncing) return enrollLocally(journeyId, startDate);

      try {
        const enrollment = await createRemoteEnrollment(getToken, journeyId, startDate);

        adoptEnrollment(enrollment);

        return enrollment.id;
      } catch {
        return null;
      }
    },
    [adoptEnrollment, enrollLocally, getToken, syncing],
  );
}

export function useSyncedLeaveJourney(): (enrollmentId: string) => void {
  const syncing = useIsSyncing();
  const getToken = useAuthTokenGetter();
  const leaveLocally = useJourneyStore((state) => state.leaveJourney);

  return useCallback(
    (enrollmentId) => {
      leaveLocally(enrollmentId);

      if (!syncing) return;

      void deleteRemoteEnrollment(getToken, enrollmentId).catch(() => {
        // As above: local state is already correct, and the next hydration is
        // the reconciliation point.
      });
    },
    [getToken, leaveLocally, syncing],
  );
}
