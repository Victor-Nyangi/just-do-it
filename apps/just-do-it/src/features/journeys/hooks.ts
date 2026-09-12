import { useJourneyStore } from './journey-store';
import type { Journey, JourneyEnrollment } from './types';

// These two look like they want to be one `useEnrolledJourney` returning the
// pair, and must not be. Zustand v5 compares snapshots by reference, so a
// selector that builds `{ enrollment, journey }` returns a fresh object on
// every store read and re-renders forever. Each of these returns an element
// that already lives in the store's array, so the reference is stable; the
// route composes the pair locally, where a new object costs nothing.
export function useJourneyEnrollment(enrollmentId: string): JourneyEnrollment | null {
  return useJourneyStore(
    (state) => state.enrollments.find((enrollment) => enrollment.id === enrollmentId) ?? null,
  );
}

export function useJourneyById(journeyId: string): Journey | null {
  return useJourneyStore(
    (state) => state.journeys.find((journey) => journey.id === journeyId) ?? null,
  );
}

export function useJourneys() {
  return useJourneyStore((state) => state.journeys);
}

export function useJourneyEnrollments() {
  return useJourneyStore((state) => state.enrollments);
}

export function useJourneyCompletions() {
  return useJourneyStore((state) => state.completions);
}

export function useToggleJourneyActivity() {
  return useJourneyStore((state) => state.toggleActivityCompletion);
}

export function useEnrollInJourney() {
  return useJourneyStore((state) => state.enrollInJourney);
}

export function useLeaveJourney() {
  return useJourneyStore((state) => state.leaveJourney);
}

export function useCreateJourney() {
  return useJourneyStore((state) => state.createJourney);
}

export function useResetJourneysToCommitted() {
  return useJourneyStore((state) => state.resetToCommittedState);
}
