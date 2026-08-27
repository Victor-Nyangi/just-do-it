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
