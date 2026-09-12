import { describe, expect, it } from 'vitest';

import { EXAMPLE_JOURNEY_COMPLETIONS } from '../../test/journey-baseline';
import { getInitialJourneyCompletions, getInitialJourneyEnrollments } from './journey-data';
import {
  buildCompletionsFileContents,
  countUncommittedChanges,
  rekeyCompletionsForExport,
  selectCommittedEnrollmentForJourney,
  sortCompletionsForExport,
} from './journey-export';
import type { JourneyCompletion } from './types';

function completion(
  dayIndex: number,
  activityId: string,
  enrollmentId = 'enrollment-discipline',
): JourneyCompletion {
  return {
    id: `${enrollmentId}:${dayIndex}:${activityId}`,
    enrollmentId,
    dayIndex,
    activityId,
    completedAt: '2026-09-12T09:00:00.000Z',
  };
}

describe('sortCompletionsForExport', () => {
  // Stable output is what keeps a day's commit diff to the lines that actually
  // changed rather than reshuffling the whole file.
  it('orders by enrollment, then day, then activity', () => {
    const sorted = sortCompletionsForExport([
      completion(2, 'day-2-reflection'),
      completion(1, 'day-1-walk-1km'),
      completion(1, 'day-1-push-ups-50'),
      completion(1, 'day-1-reflection', 'enrollment-a'),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual([
      'enrollment-a:1:day-1-reflection',
      'enrollment-discipline:1:day-1-push-ups-50',
      'enrollment-discipline:1:day-1-walk-1km',
      'enrollment-discipline:2:day-2-reflection',
    ]);
  });

  it('sorts days numerically rather than as strings', () => {
    const sorted = sortCompletionsForExport([
      completion(10, 'day-10-reflection'),
      completion(2, 'day-2-reflection'),
    ]);

    expect(sorted.map((entry) => entry.dayIndex)).toEqual([2, 10]);
  });

  it('leaves the input array alone', () => {
    const input = [completion(2, 'day-2-reflection'), completion(1, 'day-1-reflection')];

    sortCompletionsForExport(input);

    expect(input[0].dayIndex).toBe(2);
  });
});

describe('buildCompletionsFileContents', () => {
  // The output is pasted straight over the file, so it has to match what
  // Prettier writes or the next `pnpm format:check` fails.
  it('emits two-space JSON with a trailing newline', () => {
    const contents = buildCompletionsFileContents([completion(1, 'day-1-reflection')]);

    expect(contents.endsWith('\n')).toBe(true);
    expect(contents).toContain('\n  {\n    "id":');
  });

  it('round-trips back to the same completions', () => {
    const completions = [completion(1, 'day-1-walk-1km'), completion(3, 'day-3-reflection')];

    expect(JSON.parse(buildCompletionsFileContents(completions))).toEqual(
      sortCompletionsForExport(completions),
    );
  });

  it('produces identical output for the same state twice', () => {
    const completions = [completion(2, 'day-2-reflection'), completion(1, 'day-1-walk-1km')];

    expect(buildCompletionsFileContents(completions)).toBe(
      buildCompletionsFileContents([...completions].reverse()),
    );
  });

  // The committed file is itself already canonical output. Without this the
  // first export of an unchanged day would still produce a diff — the whole
  // file reordered — which would make "commit your progress" untrustworthy.
  // It fails if anyone hand-edits the fixture out of order.
  it('leaves the committed file byte-identical when nothing has changed', () => {
    const committed = getInitialJourneyCompletions();

    expect(sortCompletionsForExport(committed)).toEqual(committed);
    expect(buildCompletionsFileContents(committed)).toBe(`${JSON.stringify(committed, null, 2)}\n`);
  });
});

// These pass their own committed baseline rather than reading the live record,
// which changes every day the journey is lived.
describe('countUncommittedChanges', () => {
  const committed = EXAMPLE_JOURNEY_COMPLETIONS;

  it('counts nothing when the state matches the repo', () => {
    expect(countUncommittedChanges(committed, undefined, committed)).toBe(0);
  });

  it('counts a tick the repo does not have yet', () => {
    expect(
      countUncommittedChanges(
        [...committed, completion(2, 'day-2-reflection')],
        undefined,
        committed,
      ),
    ).toBe(1);
  });

  // Undoing something the repo already records is just as much a change to
  // commit as adding one.
  it('counts a committed tick that has since been undone', () => {
    expect(countUncommittedChanges(committed.slice(1), undefined, committed)).toBe(1);
  });

  it('counts both directions at once', () => {
    expect(
      countUncommittedChanges(
        [
          ...committed.slice(1),
          completion(2, 'day-2-reflection'),
          completion(3, 'day-3-reflection'),
        ],
        undefined,
        committed,
      ),
    ).toBe(3);
  });

  it('does not care what order the completions arrive in', () => {
    expect(countUncommittedChanges([...committed].reverse(), undefined, committed)).toBe(0);
  });

  // The default baseline is the live record, and a browser showing exactly what
  // is committed has nothing to publish — whatever day the journey has reached.
  it('defaults to the committed record and reports it as clean', () => {
    expect(countUncommittedChanges(getInitialJourneyCompletions())).toBe(0);
  });
});

describe('selectCommittedEnrollmentForJourney', () => {
  it('finds the enrollment the repo publishes a journey under', () => {
    expect(selectCommittedEnrollmentForJourney('hundred-day-discipline')).toEqual(
      getInitialJourneyEnrollments()[0],
    );
  });

  // A journey someone started themselves has no committed run to paste over,
  // and the card has to say so rather than emit a file that points nowhere.
  it('finds nothing for a journey the repo does not publish a run of', () => {
    expect(selectCommittedEnrollmentForJourney('deep-work-reset')).toBeUndefined();
  });
});

describe('rekeyCompletionsForExport', () => {
  // This is the guard on the whole publish loop. Signed in, the store holds the
  // server's enrollment id; exporting that as-is writes a file whose completions
  // point at an enrollment `journey-data.ts` has never seen, and it throws at
  // module load rather than at render — so the paste white-screens the app.
  it('moves a live run onto the committed enrollment id', () => {
    const rekeyed = rekeyCompletionsForExport(
      [completion(1, 'day-1-walk-1km', 'server-generated-uuid')],
      'server-generated-uuid',
      'enrollment-discipline',
    );

    expect(rekeyed).toEqual([
      {
        id: 'enrollment-discipline:1:day-1-walk-1km',
        enrollmentId: 'enrollment-discipline',
        dayIndex: 1,
        activityId: 'day-1-walk-1km',
        completedAt: '2026-09-12T09:00:00.000Z',
      },
    ]);
  });

  // A second journey running alongside has its own days and its own activity
  // ids, and no committed enrollment to hang them off.
  it('leaves every other enrollment out', () => {
    const rekeyed = rekeyCompletionsForExport(
      [
        completion(1, 'day-1-walk-1km', 'live'),
        completion(1, 'day-1-reflection', 'another-journey-run'),
      ],
      'live',
      'enrollment-discipline',
    );

    expect(rekeyed.map((entry) => entry.activityId)).toEqual(['day-1-walk-1km']);
  });

  it('is a no-op on a run that already carries the committed id', () => {
    const committed = [...EXAMPLE_JOURNEY_COMPLETIONS];

    expect(
      rekeyCompletionsForExport(committed, 'enrollment-discipline', 'enrollment-discipline'),
    ).toEqual(committed);
  });

  // Which is what makes the whole round trip safe: re-key, then export, and the
  // committed file comes back byte-identical when nothing was ticked.
  it('round-trips a live run back to the committed file contents', () => {
    const live = EXAMPLE_JOURNEY_COMPLETIONS.map((entry) => ({
      ...entry,
      id: `live:${entry.dayIndex}:${entry.activityId}`,
      enrollmentId: 'live',
    }));

    expect(
      buildCompletionsFileContents(
        rekeyCompletionsForExport(live, 'live', 'enrollment-discipline'),
      ),
    ).toBe(buildCompletionsFileContents(EXAMPLE_JOURNEY_COMPLETIONS));
  });
});

describe('countUncommittedChanges scoped to an enrollment', () => {
  const committed = EXAMPLE_JOURNEY_COMPLETIONS;

  // Without the scope, a second journey started locally reads as a pile of
  // changes to commit even though the repo publishes no run of it.
  it('ignores completions belonging to another enrollment', () => {
    expect(
      countUncommittedChanges(
        [...committed, completion(1, 'day-1-reflection', 'another-run')],
        'enrollment-discipline',
        committed,
      ),
    ).toBe(0);
  });

  it('still counts both directions within the enrollment', () => {
    expect(
      countUncommittedChanges(
        [...committed.slice(1), completion(2, 'day-2-reflection')],
        'enrollment-discipline',
        committed,
      ),
    ).toBe(2);
  });
});
