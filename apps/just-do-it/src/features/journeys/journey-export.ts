import { validatedJourneyCompletionFixture } from './journey-data';
import type { JourneyCompletion } from './types';

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

// How far this browser has drifted from what is committed, counted in both
// directions: a tick that is not in the repo yet, and a tick the repo has that
// has since been undone here. Zero means there is nothing to commit.
export function countUncommittedChanges(completions: readonly JourneyCompletion[]): number {
  const committedIds = new Set(
    validatedJourneyCompletionFixture.map((completion) => completion.id),
  );
  const currentIds = new Set(completions.map((completion) => completion.id));

  let changed = 0;

  for (const id of currentIds) {
    if (!committedIds.has(id)) changed += 1;
  }

  for (const id of committedIds) {
    if (!currentIds.has(id)) changed += 1;
  }

  return changed;
}
