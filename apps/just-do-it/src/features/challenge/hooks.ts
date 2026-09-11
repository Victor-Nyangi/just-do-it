import { useChallengeStore } from './challenge-store';

export function useChallenge() {
  return useChallengeStore((state) => state.challenge);
}

export function useChallengeBooks() {
  return useChallengeStore((state) => state.books);
}

export function useChallengeCompletions() {
  return useChallengeStore((state) => state.completions);
}

export function useToggleChallengeActivity() {
  return useChallengeStore((state) => state.toggleActivityCompletion);
}
