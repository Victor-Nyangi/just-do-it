import { describe, expect, it } from 'vitest';

import { getInitialJourneyCompletions } from './journey-data';
import {
  buildCompletionsFileContents,
  countUncommittedChanges,
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

describe('countUncommittedChanges', () => {
  it('counts nothing when the state matches the repo', () => {
    expect(countUncommittedChanges(getInitialJourneyCompletions())).toBe(0);
  });

  it('counts a tick the repo does not have yet', () => {
    expect(
      countUncommittedChanges([
        ...getInitialJourneyCompletions(),
        completion(2, 'day-2-reflection'),
      ]),
    ).toBe(1);
  });

  // Undoing something the repo already records is just as much a change to
  // commit as adding one.
  it('counts a committed tick that has since been undone', () => {
    expect(countUncommittedChanges(getInitialJourneyCompletions().slice(1))).toBe(1);
  });

  it('counts both directions at once', () => {
    expect(
      countUncommittedChanges([
        ...getInitialJourneyCompletions().slice(1),
        completion(2, 'day-2-reflection'),
        completion(3, 'day-3-reflection'),
      ]),
    ).toBe(3);
  });

  it('does not care what order the completions arrive in', () => {
    expect(countUncommittedChanges([...getInitialJourneyCompletions()].reverse())).toBe(0);
  });
});
