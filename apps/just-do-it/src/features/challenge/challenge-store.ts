import { create } from 'zustand';

import {
  challengeCompletionSchema,
  getInitialChallenge,
  getInitialChallengeBooks,
  getInitialChallengeCompletions,
} from './challenge-data';
import { buildDayPlan } from './challenge-plan';
import type { Challenge, ChallengeBook, ChallengeCompletion } from './types';

type ChallengeStoreState = {
  challenge: Challenge;
  books: ChallengeBook[];
  completions: ChallengeCompletion[];
  toggleActivityCompletion: (dayIndex: number, activityId: string, now?: Date) => void;
};

function buildChallengeCompletionRecord(
  completionId: string,
  dayIndex: number,
  activityId: string,
  completedAt: Date,
): ChallengeCompletion {
  return challengeCompletionSchema.parse({
    id: completionId,
    dayIndex,
    activityId,
    completedAt: completedAt.toISOString(),
  });
}

export const useChallengeStore = create<ChallengeStoreState>()((set) => ({
  challenge: getInitialChallenge(),
  books: getInitialChallengeBooks(),
  completions: getInitialChallengeCompletions(),
  toggleActivityCompletion: (dayIndex, activityId, now = new Date()) => {
    set((state) => {
      // The plan is generated rather than stored, so this is the only place
      // that can tell a real activity id from a stale or invented one. Without
      // it a completion could be written against an activity no day offers.
      const plan = buildDayPlan(state.challenge, state.books, dayIndex);
      if (!plan?.activities.some((activity) => activity.id === activityId)) return state;

      const existingCompletion = state.completions.find(
        (completion) => completion.activityId === activityId,
      );

      if (existingCompletion) {
        return {
          completions: state.completions.filter(
            (completion) => completion.id !== existingCompletion.id,
          ),
        };
      }

      return {
        completions: [
          ...state.completions,
          buildChallengeCompletionRecord(crypto.randomUUID(), dayIndex, activityId, now),
        ],
      };
    });
  },
}));
