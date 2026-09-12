import {
  validatedJourneyCompletionFixture,
  validatedJourneyEnrollmentFixture,
} from './journey-data';
import { toCompletionId } from './journey-store';
import type { JourneyCompletion, JourneyEnrollment } from './types';

// The deployed app cannot write to the repository — it is a static bundle, and
// `journey-completions.json` is baked into the JavaScript at build time. So the
// commit is a deliberate act rather than an automatic one: the app hands back
// the exact file content, and committing it is what turns a browser-local tick
// into the public record. The git history is then the log of the hundred days,
// which is a better artefact than a row in a database would be.

// Sorted so that exporting the same state twice is byte-identical, and so that
// a day's commit diff reads in the order the day was lived. Combined with the
// deterministic completion ids from `journey-store.ts`, this keeps the diff to
// exactly the lines that changed.
export function sortCompletionsForExport(
  completions: readonly JourneyCompletion[],
): JourneyCompletion[] {
  return [...completions].sort((leftCompletion, rightCompletion) => {
    if (leftCompletion.enrollmentId !== rightCompletion.enrollmentId) {
      return leftCompletion.enrollmentId < rightCompletion.enrollmentId ? -1 : 1;
    }

    if (leftCompletion.dayIndex !== rightCompletion.dayIndex) {
      return leftCompletion.dayIndex - rightCompletion.dayIndex;
    }

    if (leftCompletion.activityId === rightCompletion.activityId) return 0;

    return leftCompletion.activityId < rightCompletion.activityId ? -1 : 1;
  });
}

// Matches what Prettier writes for this file — two-space indent and a trailing
// newline — so that pasting the output over `src/data/journey-completions.json`
// does not then fail `pnpm format:check`.
export function buildCompletionsFileContents(completions: readonly JourneyCompletion[]): string {
  return `${JSON.stringify(sortCompletionsForExport(completions), null, 2)}\n`;
}

// The repo commits one enrollment per published journey, and
// `journey-completions.json` is keyed on that enrollment's id. The enrollment a
// browser is actually running almost never carries it: the server generates the
// id when signed in, and `crypto.randomUUID()` does when a second run is started
// locally. Exporting those rows as-is writes completions pointing at an
// enrollment the repo has never heard of, which `journey-data.ts` refuses at
// module load — so the paste would not fail a test, it would white-screen the
// deployed app on boot.
export function selectCommittedEnrollmentForJourney(
  journeyId: string,
): JourneyEnrollment | undefined {
  return validatedJourneyEnrollmentFixture.find((entry) => entry.journeyId === journeyId);
}

// Re-keying is a rename rather than a reinterpretation: an activity id depends
// only on the journey and the day index — the enrollment supplies the calendar
// date and nothing else — so day four of this run means exactly what day four of
// the committed run means. The ids are re-derived through `toCompletionId` so
// they stay the deterministic triple the export order and the D1 primary key
// both rely on.
export function rekeyCompletionsForExport(
  completions: readonly JourneyCompletion[],
  sourceEnrollmentId: string,
  committedEnrollmentId: string,
): JourneyCompletion[] {
  return completions
    .filter((completion) => completion.enrollmentId === sourceEnrollmentId)
    .map((completion) => ({
      ...completion,
      id: toCompletionId(committedEnrollmentId, completion.dayIndex, completion.activityId),
      enrollmentId: committedEnrollmentId,
    }));
}

// How far this browser has drifted from what is committed, counted in both
// directions: a tick that is not in the repo yet, and a tick the repo has that
// has since been undone here. Zero means there is nothing to commit. Pass the
// enrollment id when counting a single run's drift, so that a second journey
// started locally does not read as a hundred missing commits.
//
// `committedCompletions` is injectable for the same reason selectors take an
// injectable `now`: the default is the live record, which changes every day the
// journey is lived, and a test that pinned its own expectations to whatever was
// committed that morning would fail on the next commit.
export function countUncommittedChanges(
  completions: readonly JourneyCompletion[],
  enrollmentId?: string,
  committedCompletions: readonly JourneyCompletion[] = validatedJourneyCompletionFixture,
): number {
  const committed =
    enrollmentId === undefined
      ? committedCompletions
      : committedCompletions.filter((completion) => completion.enrollmentId === enrollmentId);
  const current =
    enrollmentId === undefined
      ? completions
      : completions.filter((completion) => completion.enrollmentId === enrollmentId);
  const committedIds = new Set(committed.map((completion) => completion.id));
  const currentIds = new Set(current.map((completion) => completion.id));

  let changed = 0;

  for (const id of currentIds) {
    if (!committedIds.has(id)) changed += 1;
  }

  for (const id of committedIds) {
    if (!currentIds.has(id)) changed += 1;
  }

  return changed;
}
