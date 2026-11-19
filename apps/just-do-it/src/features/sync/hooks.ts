import { useCallback, useContext } from 'react';

import { useAuthSnapshot, useAuthTokenGetter } from '../auth';
import { useJourneyStore } from '../journeys';
import { createRemoteEnrollment, deleteRemoteEnrollment, pushToggle } from './sync-client';
import { isApiConfigured } from './sync-config';
import { SyncStatusContext } from './sync-context';
import type { JourneyRestartResult, SyncSnapshot } from './types';

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

const NOT_RESTARTED: JourneyRestartResult = { status: 'not-restarted' };

// Restarting is a new run of the same journey on a chosen day, replacing the
// old run and everything ticked on it. It is composed from the two paths above
// rather than being a single server call, so the API needs nothing new.
//
// The order is the point: the new run is created first and the old one removed
// only once that has worked. A failure part-way therefore leaves, at worst, two
// runs of the same journey — which the server already permits — and never none.
export function useSyncedRestartEnrollment(): (
  enrollmentId: string,
  startDate: string,
) => Promise<JourneyRestartResult> {
  const syncing = useIsSyncing();
  const getToken = useAuthTokenGetter();
  const enrollInJourney = useSyncedEnrollInJourney();
  const leaveLocally = useJourneyStore((state) => state.leaveJourney);

  return useCallback(
    async (enrollmentId, startDate) => {
      // Read at call time rather than subscribed to: the hook has no reason to
      // re-render when enrollments change, only to know which journey this is.
      const existing = useJourneyStore
        .getState()
        .enrollments.find((enrollment) => enrollment.id === enrollmentId);

      if (!existing) return NOT_RESTARTED;

      // Signed in, this round-trips and adopts the server's row; signed out it
      // is the local action. Either way a failure is a null and nothing moved.
      const newEnrollmentId = await enrollInJourney(existing.journeyId, startDate);

      if (!newEnrollmentId) return NOT_RESTARTED;

      if (syncing) {
        // Unlike a plain leave, this waits for the server before touching the
        // local record. A leave that fails is invisible until the next
        // hydration brings the run back; here the person has just been told
        // their journey restarted, so a run that would quietly reappear has to
        // be reported instead, and kept locally so what they see stays true.
        try {
          await deleteRemoteEnrollment(getToken, enrollmentId);
        } catch {
          return { status: 'old-run-kept', enrollmentId: newEnrollmentId };
        }
      }

      leaveLocally(enrollmentId);

      return { status: 'restarted', enrollmentId: newEnrollmentId };
    },
    [enrollInJourney, getToken, leaveLocally, syncing],
  );
}
