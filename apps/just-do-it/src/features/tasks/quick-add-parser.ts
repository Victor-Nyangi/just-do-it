import { addDays, addYears, format, isValid, nextDay, parse, startOfDay, type Day } from 'date-fns';

import {
  TASK_CATEGORY_VALUES,
  TASK_PRIORITY_VALUES,
  type TaskCategory,
  type TaskPriority,
} from './types';

export type QuickAddParseResult = {
  title: string;
  dueDate?: string;
  category?: TaskCategory;
  priority?: TaskPriority;
};

type Match<TValue> = {
  value: TValue;
  start: number;
  end: number;
};

// `#` and `!` are literals in a regex. Escaping either one under the `u` flag
// throws "Invalid escape", so the sigil is interpolated bare.
function matchSigil<TValue extends string>(
  text: string,
  sigil: '#' | '!',
  allowedValues: readonly TValue[],
): Match<TValue> | null {
  const pattern = new RegExp(`${sigil}(\\w+)`, 'gu');

  for (const candidate of text.matchAll(pattern)) {
    const word = candidate[1].toLowerCase();
    const matchedValue = allowedValues.find((allowed) => allowed.toLowerCase() === word);

    if (matchedValue !== undefined) {
      return {
        value: matchedValue,
        start: candidate.index,
        end: candidate.index + candidate[0].length,
      };
    }
  }

  return null;
}

// Longer forms first in every alternation: `sun` before `sunday` would match the
// prefix of "sunday" and strand "day" in the title.
const WEEKDAYS: ReadonlyArray<{ pattern: string; day: Day }> = [
  { pattern: 'sunday|sun', day: 0 },
  { pattern: 'monday|mon', day: 1 },
  { pattern: 'tuesday|tue', day: 2 },
  { pattern: 'wednesday|wed', day: 3 },
  { pattern: 'thursday|thu', day: 4 },
  { pattern: 'friday|fri', day: 5 },
  { pattern: 'saturday|sat', day: 6 },
];

const ANY_WEEKDAY = WEEKDAYS.map((weekday) => weekday.pattern).join('|');

const ANY_MONTH =
  'january|february|march|april|may|june|july|august|september|october|november|december|' +
  'jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec';

// `date-fns` does not know the four-letter `sept`: both `parse('sept 5', 'MMMM d')` and
// `parse('sept 5', 'MMM d')` are Invalid, while `sep`, `aug` and `september` all resolve. So
// `MMM` is no rescue here and is deliberately still absent — `MMMM` already accepts every
// abbreviation `date-fns` recognises, and `MMM` would reject "August 20". `sept` stays in the
// alternation so the token is matched and stripped, and is rewritten to `sep` for the parse.
//
// Cutting a matched sigil out of the middle of a date phrase also leaves a run of spaces, and
// `parse('3  august', 'd MMMM')` is Invalid where `parse('3 august', 'd MMMM')` is not, so the
// matched text's internal whitespace is collapsed before it reaches `parse`.
function normalizeMonthDayText(text: string): string {
  return collapseWhitespace(text).replace(/\bsept\b/giu, 'sep');
}

type TextSpan = { text: string; start: number; end: number };

function findFirst(text: string, pattern: RegExp): TextSpan | null {
  const found = pattern.exec(text);

  if (!found) return null;

  return { text: found[0], start: found.index, end: found.index + found[0].length };
}

function resolveWeekday(phrase: string, now: Date): Date | null {
  const weekday = WEEKDAYS.find((candidate) =>
    new RegExp(`(?:${candidate.pattern})$`, 'iu').test(phrase),
  );

  // `nextDay` is strictly future: a weekday naming today resolves to next week.
  return weekday ? startOfDay(nextDay(now, weekday.day)) : null;
}

function matchDate(text: string, now: Date): Match<Date> | null {
  const isoSpan = findFirst(text, /\b\d{4}-\d{2}-\d{2}\b/u);

  if (isoSpan) {
    const parsed = parse(isoSpan.text, 'yyyy-MM-dd', now);

    if (isValid(parsed)) {
      return { value: startOfDay(parsed), start: isoSpan.start, end: isoSpan.end };
    }
  }

  // "next Friday" must be tried before the bare weekday, or the bare matcher
  // consumes "Friday" and strands "next" in the title.
  const nextWeekdaySpan = findFirst(text, new RegExp(`\\bnext\\s+(?:${ANY_WEEKDAY})\\b`, 'iu'));

  if (nextWeekdaySpan) {
    const resolved = resolveWeekday(nextWeekdaySpan.text, now);

    if (resolved) {
      return { value: resolved, start: nextWeekdaySpan.start, end: nextWeekdaySpan.end };
    }
  }

  const monthDaySpan =
    findFirst(text, new RegExp(`\\b(?:${ANY_MONTH})\\s+\\d{1,2}\\b`, 'iu')) ??
    findFirst(text, new RegExp(`\\b\\d{1,2}\\s+(?:${ANY_MONTH})\\b`, 'iu'));

  if (monthDaySpan) {
    // `MMMM` accepts the abbreviated month too, so these two cover all four
    // spellings. See `normalizeMonthDayText` for why `MMM` is not a fallback.
    for (const dateFormat of ['MMMM d', 'd MMMM']) {
      const parsed = parse(normalizeMonthDayText(monthDaySpan.text), dateFormat, now);

      if (isValid(parsed)) {
        const atStartOfDay = startOfDay(parsed);
        const resolved = atStartOfDay < startOfDay(now) ? addYears(atStartOfDay, 1) : atStartOfDay;

        return { value: resolved, start: monthDaySpan.start, end: monthDaySpan.end };
      }
    }
  }

  // One combined alternation, so the leftmost weekday in the text wins. Looping
  // over WEEKDAYS instead would return the first in list order.
  const weekdaySpan = findFirst(text, new RegExp(`\\b(?:${ANY_WEEKDAY})\\b`, 'iu'));

  if (weekdaySpan) {
    const resolved = resolveWeekday(weekdaySpan.text, now);

    if (resolved) {
      return { value: resolved, start: weekdaySpan.start, end: weekdaySpan.end };
    }
  }

  const todaySpan = findFirst(text, /\btoday\b/iu);

  if (todaySpan) {
    return { value: startOfDay(now), start: todaySpan.start, end: todaySpan.end };
  }

  const tomorrowSpan = findFirst(text, /\btomorrow\b/iu);

  if (tomorrowSpan) {
    return { value: startOfDay(addDays(now, 1)), start: tomorrowSpan.start, end: tomorrowSpan.end };
  }

  return null;
}

// Overlapping spans are merged before anything is cut, then the merged spans are
// cut back-to-front so that removing one does not shift the indices of the ones
// still to be removed. The merge is not defensive padding: slicing two spans that
// overlap applies the second slice to already-shortened text and silently eats
// real title characters, so disjointness must be guaranteed here rather than
// assumed of the callers.
function cutSpans(
  text: string,
  spans: ReadonlyArray<{ start: number; end: number } | null>,
): string {
  const ascending = spans
    .filter((span) => span !== null)
    .sort((leftSpan, rightSpan) => leftSpan.start - rightSpan.start);

  const merged: Array<{ start: number; end: number }> = [];

  for (const span of ascending) {
    const previous = merged[merged.length - 1];

    if (previous !== undefined && span.start <= previous.end) {
      previous.end = Math.max(previous.end, span.end);
    } else {
      merged.push({ start: span.start, end: span.end });
    }
  }

  return merged
    .reverse()
    .reduce((remaining, span) => remaining.slice(0, span.start) + remaining.slice(span.end), text);
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

// The sigils still present once the matched ones have been cut are exactly the
// unmatched ones, and they are blanked before dates are scanned. Leaving them in
// is not an option: `#Monday` is not a category, so it survives into the date
// scan, and `\b` matches between `#` and `M` — the weekday matcher would read a
// due date out of it.
//
// The filler is a dot, one per character, so indices still line up with the text
// handed in. It must be neither `\w` nor `\s`: with spaces, the matchers that
// bridge whitespace (`next\s+<weekday>` and both month-day forms) could stretch a
// date span *across* a masked sigil, and cutting that span would take title text
// with it. A dot cannot be bridged by `\s+` and cannot start a `\b\w` run, so no
// date span can span a masked sigil.
function maskSigils(text: string): string {
  return text.replace(/[#!]\w+/gu, (token) => '.'.repeat(token.length));
}

export function parseQuickAdd(input: string, now = new Date()): QuickAddParseResult {
  const categoryMatch = matchSigil(input, '#', TASK_CATEGORY_VALUES);
  const priorityMatch = matchSigil(input, '!', TASK_PRIORITY_VALUES);

  // The matched sigils are cut before the date is looked for, so the date span's
  // indices address this intermediate string and nothing else. Matching the date
  // against the original input instead would produce a span that can overlap a
  // sigil span, and cutting the two together would corrupt the title.
  const withoutMatchedSigils = cutSpans(input, [categoryMatch, priorityMatch]);
  const dateMatch = matchDate(maskSigils(withoutMatchedSigils), now);

  // Absent fields are omitted rather than set to `undefined`, so `'dueDate' in
  // result` answers the question it looks like it answers.
  return {
    title: collapseWhitespace(cutSpans(withoutMatchedSigils, [dateMatch])),
    ...(dateMatch !== null ? { dueDate: format(dateMatch.value, 'yyyy-MM-dd') } : {}),
    ...(categoryMatch !== null ? { category: categoryMatch.value } : {}),
    ...(priorityMatch !== null ? { priority: priorityMatch.value } : {}),
  };
}
