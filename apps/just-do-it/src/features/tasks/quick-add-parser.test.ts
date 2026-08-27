import { describe, expect, it } from 'vitest';

import { parseQuickAdd } from './quick-add-parser';

const now = new Date(2026, 7, 27); // Thursday 2026-08-27, local time

describe('parseQuickAdd — plain text', () => {
  it('returns the whole input as the title when nothing matches', () => {
    expect(parseQuickAdd('Call the dentist', now).title).toBe('Call the dentist');
  });

  it('derives no fields from plain text', () => {
    const parsed = parseQuickAdd('Call the dentist', now);

    expect(parsed.dueDate).toBeUndefined();
    expect(parsed.category).toBeUndefined();
    expect(parsed.priority).toBeUndefined();
  });

  it('trims surrounding whitespace', () => {
    expect(parseQuickAdd('   Call the dentist   ', now).title).toBe('Call the dentist');
  });

  it('collapses runs of whitespace', () => {
    expect(parseQuickAdd('Call    the   dentist', now).title).toBe('Call the dentist');
  });

  it('returns an empty title for empty input', () => {
    expect(parseQuickAdd('', now).title).toBe('');
  });

  it('returns an empty title for whitespace-only input', () => {
    expect(parseQuickAdd('    ', now).title).toBe('');
  });
});

describe('parseQuickAdd — category sigil', () => {
  it('reads a category and strips it from the title', () => {
    const parsed = parseQuickAdd('Finish the chapter #Reading', now);

    expect(parsed.category).toBe('Reading');
    expect(parsed.title).toBe('Finish the chapter');
  });

  it('matches a category case-insensitively', () => {
    expect(parseQuickAdd('Finish the chapter #reading', now).category).toBe('Reading');
  });

  it('leaves an unknown category in the title', () => {
    const parsed = parseQuickAdd('Email #Groceries', now);

    expect(parsed.category).toBeUndefined();
    expect(parsed.title).toBe('Email #Groceries');
  });

  it('keeps the first of two categories and leaves the second in the title', () => {
    const parsed = parseQuickAdd('Plan #Reading #Workout', now);

    expect(parsed.category).toBe('Reading');
    expect(parsed.title).toBe('Plan #Workout');
  });

  it('skips an unknown sigil to find a real category later in the text', () => {
    const parsed = parseQuickAdd('Email #Groceries #Errand', now);

    expect(parsed.category).toBe('Errand');
    expect(parsed.title).toBe('Email #Groceries');
  });
});

describe('parseQuickAdd — priority sigil', () => {
  it('reads a priority and strips it from the title', () => {
    const parsed = parseQuickAdd('Ship the release !urgent', now);

    expect(parsed.priority).toBe('urgent');
    expect(parsed.title).toBe('Ship the release');
  });

  it('matches a priority case-insensitively', () => {
    expect(parseQuickAdd('Ship the release !URGENT', now).priority).toBe('urgent');
  });

  it('leaves an unknown priority in the title', () => {
    const parsed = parseQuickAdd('Ship the release !yesterday', now);

    expect(parsed.priority).toBeUndefined();
    expect(parsed.title).toBe('Ship the release !yesterday');
  });

  it('reads both sigils from one input', () => {
    const parsed = parseQuickAdd('Ship the release #Hobby !high', now);

    expect(parsed.category).toBe('Hobby');
    expect(parsed.priority).toBe('high');
    expect(parsed.title).toBe('Ship the release');
  });

  it('returns an empty title when the input is only a sigil', () => {
    const parsed = parseQuickAdd('#Reading', now);

    expect(parsed.category).toBe('Reading');
    expect(parsed.title).toBe('');
  });
});

describe('parseQuickAdd — relative dates', () => {
  it('resolves "today" to the injected now', () => {
    expect(parseQuickAdd('Pay the bill today', now).dueDate).toBe('2026-08-27');
  });

  it('resolves "tomorrow" to the following day', () => {
    expect(parseQuickAdd('Pay the bill tomorrow', now).dueDate).toBe('2026-08-28');
  });

  it('strips the matched date from the title', () => {
    expect(parseQuickAdd('Pay the bill tomorrow', now).title).toBe('Pay the bill');
  });

  it('matches a date word case-insensitively', () => {
    expect(parseQuickAdd('Pay the bill Tomorrow', now).dueDate).toBe('2026-08-28');
  });

  it('does not match a date word inside a longer word', () => {
    const parsed = parseQuickAdd('Review the todayish draft', now);

    expect(parsed.dueDate).toBeUndefined();
    expect(parsed.title).toBe('Review the todayish draft');
  });
});

describe('parseQuickAdd — weekdays', () => {
  it('resolves a weekday to its next occurrence', () => {
    expect(parseQuickAdd('Read 20 pages Friday', now).dueDate).toBe('2026-08-28');
  });

  it('accepts the three-letter form', () => {
    expect(parseQuickAdd('Read 20 pages fri', now).dueDate).toBe('2026-08-28');
  });

  it('resolves a weekday that is today to the following week', () => {
    // `now` is a Thursday. "Thursday" therefore means next Thursday, not today.
    expect(parseQuickAdd('Standup Thursday', now).dueDate).toBe('2026-09-03');
  });

  it('resolves "next <weekday>" the same way as the bare weekday', () => {
    expect(parseQuickAdd('Read 20 pages next Friday', now).dueDate).toBe('2026-08-28');
  });

  it('strips the whole "next <weekday>" phrase, leaving no stray "next"', () => {
    expect(parseQuickAdd('Read 20 pages next Friday', now).title).toBe('Read 20 pages');
  });

  it('uses the leftmost weekday when two appear', () => {
    // Friday is 5 and Monday is 1, so a per-weekday loop would wrongly pick Monday.
    expect(parseQuickAdd('Call Friday about Monday', now).dueDate).toBe('2026-08-28');
  });
});

describe('parseQuickAdd — month and day', () => {
  it('reads an abbreviated month before the day', () => {
    expect(parseQuickAdd('Finish portfolio Dec 25', now).dueDate).toBe('2026-12-25');
  });

  it('reads a full month name', () => {
    expect(parseQuickAdd('Finish portfolio December 25', now).dueDate).toBe('2026-12-25');
  });

  it('reads the day before the month', () => {
    expect(parseQuickAdd('Finish portfolio 25 Dec', now).dueDate).toBe('2026-12-25');
  });

  it('rolls a past month-day forward to next year', () => {
    // `now` is 2026-08-27, so 20 August has already gone.
    expect(parseQuickAdd('Finish portfolio Aug 20', now).dueDate).toBe('2027-08-20');
  });

  it('does not roll a future month-day forward', () => {
    expect(parseQuickAdd('Finish portfolio Aug 28', now).dueDate).toBe('2026-08-28');
  });

  it('strips the matched month-day from the title', () => {
    expect(parseQuickAdd('Finish portfolio Aug 20', now).title).toBe('Finish portfolio');
  });
});

describe('parseQuickAdd — ISO dates', () => {
  it('reads an ISO date as written', () => {
    expect(parseQuickAdd('Renew the licence 2026-11-30', now).dueDate).toBe('2026-11-30');
  });

  it('strips the ISO date from the title', () => {
    expect(parseQuickAdd('Renew the licence 2026-11-30', now).title).toBe('Renew the licence');
  });

  it('leaves an impossible ISO date in the title', () => {
    const parsed = parseQuickAdd('Renew the licence 2026-13-45', now);

    expect(parsed.dueDate).toBeUndefined();
    expect(parsed.title).toBe('Renew the licence 2026-13-45');
  });
});

describe('parseQuickAdd — matcher precedence', () => {
  it('prefers an ISO date over a weekday appearing later', () => {
    expect(parseQuickAdd('Ship 2026-11-30 by Monday', now).dueDate).toBe('2026-11-30');
  });

  it('keeps only the first date and leaves the second in the title', () => {
    const parsed = parseQuickAdd('Ship today or tomorrow', now);

    expect(parsed.dueDate).toBe('2026-08-27');
    expect(parsed.title).toBe('Ship or tomorrow');
  });

  it('reads a date and both sigils together', () => {
    const parsed = parseQuickAdd('Read 20 pages Friday #Reading !high', now);

    expect(parsed).toEqual({
      title: 'Read 20 pages',
      dueDate: '2026-08-28',
      category: 'Reading',
      priority: 'high',
    });
  });

  it('does not read a date out of the category sigil', () => {
    // Without masking sigils first, "#Monday" would be scanned for a weekday.
    const parsed = parseQuickAdd('Plan the week #Monday', now);

    expect(parsed.dueDate).toBeUndefined();
    expect(parsed.title).toBe('Plan the week #Monday');
  });
});

describe('parseQuickAdd — a sigil sitting inside a date phrase', () => {
  // Regression: the date was matched against a copy of the input in which sigils
  // were blanked with *spaces*, so `next␣␣␣␣␣␣␣␣␣monday` still matched
  // `next\s+monday` and produced a date span overlapping the category span.
  // Cutting both then sliced the same region twice and ate the title.
  it('reads "next <weekday>" split by a category sigil without eating the title', () => {
    const parsed = parseQuickAdd('next #Reading monday buy milk', now);

    expect(parsed).toEqual({
      title: 'buy milk',
      dueDate: '2026-08-31',
      category: 'Reading',
    });
  });

  it('reads "next <weekday>" split by a priority sigil without eating the title', () => {
    const parsed = parseQuickAdd('next !high friday call mum', now);

    expect(parsed).toEqual({
      title: 'call mum',
      dueDate: '2026-08-28',
      priority: 'high',
    });
  });

  it('reads a month-day split by a sigil, and rolls it forward', () => {
    const parsed = parseQuickAdd('3 #Reading august pay rent', now);

    expect(parsed).toEqual({
      title: 'pay rent',
      dueDate: '2027-08-03',
      category: 'Reading',
    });
  });

  it('reads a month-before-day split by a sigil', () => {
    const parsed = parseQuickAdd('Ship aug !high 20 the build', now);

    expect(parsed).toEqual({
      title: 'Ship the build',
      dueDate: '2027-08-20',
      priority: 'high',
    });
  });

  it('never lets a date span swallow an unmatched sigil', () => {
    // With a space filler the masked `#Groceries` would let `next\s+monday`
    // match across it, and cutting that span would delete text the user typed.
    // A dot filler cannot be bridged, so only the bare weekday matches.
    const parsed = parseQuickAdd('next #Groceries monday buy milk', now);

    expect(parsed).toEqual({
      title: 'next #Groceries buy milk',
      dueDate: '2026-08-31',
    });
  });

  it('still reads no date out of an unmatched sigil that names a weekday', () => {
    // The masked sigil is filled with a character that is neither `\w` nor `\s`,
    // so `next\s+monday` cannot bridge it either.
    const parsed = parseQuickAdd('Plan the week next #Monday', now);

    expect(parsed.dueDate).toBeUndefined();
    expect(parsed.title).toBe('Plan the week next #Monday');
  });
});

describe('parseQuickAdd — the four-letter "sept"', () => {
  // `date-fns` rejects `sept` under both `MMMM` and `MMM`; it is rewritten to
  // `sep` before the parse rather than dropped from the alternation.
  it('resolves "sept <day>"', () => {
    const parsed = parseQuickAdd('Ship it sept 5', now);

    expect(parsed).toEqual({ title: 'Ship it', dueDate: '2026-09-05' });
  });

  it('resolves "<day> sept"', () => {
    expect(parseQuickAdd('Ship it 5 sept', now).dueDate).toBe('2026-09-05');
  });

  it('resolves a capitalised "Sept"', () => {
    expect(parseQuickAdd('Ship it Sept 5', now).dueDate).toBe('2026-09-05');
  });

  it('does not mistake "september" for "sept"', () => {
    expect(parseQuickAdd('Ship it september 5', now).dueDate).toBe('2026-09-05');
  });
});

describe('parseQuickAdd — adjacent and degenerate sigils', () => {
  it('reads two sigils written with no space between them', () => {
    const parsed = parseQuickAdd('#Reading!high', now);

    expect(parsed).toEqual({ title: '', category: 'Reading', priority: 'high' });
  });

  it('leaves a bare "#" in the title when the sigil has no word', () => {
    const parsed = parseQuickAdd('#!high', now);

    expect(parsed).toEqual({ title: '#', priority: 'high' });
  });

  it('reads a priority sigil written flush against a word', () => {
    const parsed = parseQuickAdd('wow!high', now);

    expect(parsed).toEqual({ title: 'wow', priority: 'high' });
  });

  it('leaves a non-ASCII sigil word in the title untouched', () => {
    // `\w` is ASCII-only, so the sigil pattern reads only `#R` out of `#Réading`.
    // That is not a category, and the whole token survives into the title.
    const parsed = parseQuickAdd('#Réading', now);

    expect(parsed).toEqual({ title: '#Réading' });
  });

  it('returns an empty title for whitespace around a lone sigil', () => {
    const parsed = parseQuickAdd('   #Reading   ', now);

    expect(parsed).toEqual({ title: '', category: 'Reading' });
  });
});

describe('parseQuickAdd — "may" as an ordinary word', () => {
  it('reads no date from "may" with no day after it', () => {
    const parsed = parseQuickAdd('I may call the dentist', now);

    expect(parsed.dueDate).toBeUndefined();
    expect(parsed.title).toBe('I may call the dentist');
  });

  it('still reads "may" followed by a day as a month-day', () => {
    // Documented limitation, pinned so a change to it is deliberate.
    expect(parseQuickAdd('Read the may 20 report', now).dueDate).toBe('2027-05-20');
  });
});

describe('parseQuickAdd — result shape', () => {
  it('omits the keys it did not derive', () => {
    const parsed = parseQuickAdd('Call the dentist', now);

    expect(parsed).toEqual({ title: 'Call the dentist' });
    expect(Object.keys(parsed)).toEqual(['title']);
    expect('dueDate' in parsed).toBe(false);
    expect('category' in parsed).toBe(false);
    expect('priority' in parsed).toBe(false);
  });

  it('carries only the keys it did derive', () => {
    const parsed = parseQuickAdd('Ship the release !urgent', now);

    expect('priority' in parsed).toBe(true);
    expect('dueDate' in parsed).toBe(false);
    expect('category' in parsed).toBe(false);
  });
});
