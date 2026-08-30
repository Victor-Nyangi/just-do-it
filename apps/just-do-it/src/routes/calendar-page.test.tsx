// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CalendarPage } from './calendar-page';

// Tuesday 15 December 2026, at midday rather than midnight so that the clock
// creeping forward under `shouldAdvanceTime` can never roll the date over. The
// calendar reads the real clock, so every test pins it — otherwise these
// assertions rot the moment the month turns.
//
// December is deliberately a month the fixtures do not reach: the newest data
// is a goal target on 30 September 2026. That makes it the right place to pin
// the structural tests (grid shape, navigation, agenda framing), which should
// not depend on data, and the wrong place to test anything data-driven — hence
// the August block at the bottom of this file.
const pinnedNow = new Date(2026, 11, 15, 12, 0, 0);

function renderCalendar() {
  return render(
    <MemoryRouter>
      <CalendarPage />
    </MemoryRouter>,
  );
}

// Day cells are the buttons whose accessible name begins with a weekday, e.g.
// "Monday, November 30, 2026. No scheduled items". Month navigation buttons are
// named "Show <Month> <Year>" and are excluded by that pattern.
function getDayCells() {
  return screen
    .getAllByRole('button')
    .filter((button) => /^\w+day, /u.test(button.getAttribute('aria-label') ?? ''));
}

function getDayCellLabels() {
  return getDayCells().map((button) => button.getAttribute('aria-label') ?? '');
}

function setUpUser() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(pinnedNow);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CalendarPage — the month grid', () => {
  it('opens on the month containing today', () => {
    renderCalendar();

    expect(screen.getByRole('heading', { name: 'December 2026' })).toBeInTheDocument();
  });

  it('renders 35 cells for December 2026, a whole number of weeks', () => {
    renderCalendar();

    expect(getDayCells()).toHaveLength(35);
    expect(getDayCells().length % 7).toBe(0);
  });

  it('starts the grid on the Monday before the first of the month', () => {
    renderCalendar();

    expect(getDayCellLabels()[0]).toMatch(/^Monday, November 30, 2026\./u);
  });

  it('ends the grid on the Sunday after the last of the month', () => {
    renderCalendar();

    expect(getDayCellLabels().at(-1)).toMatch(/^Sunday, January 3, 2027\./u);
  });

  // The first cell, the last cell and the count together still permit a grid
  // with duplicated or missing days in the interior. Checking that every row
  // opens on a Monday is the cheapest assertion that rules that out.
  it('starts every row on a Monday', () => {
    renderCalendar();

    const labels = getDayCellLabels();

    for (const rowStart of [0, 7, 14, 21, 28]) {
      expect(labels[rowStart]).toMatch(/^Monday, /u);
    }
  });
});

describe('CalendarPage — month navigation', () => {
  it('crosses the year boundary from December 2026 to January 2027', async () => {
    const user = setUpUser();
    renderCalendar();

    await user.click(screen.getByRole('button', { name: 'Show January 2027' }));

    expect(screen.getByRole('heading', { name: 'January 2027' })).toBeInTheDocument();
    // Changing month also carries the selected day across, clamped into the new
    // month. Without this the whole `setSelectedDate` half of `changeMonth`
    // could be deleted and every other assertion here would still pass.
    expect(screen.getByText('A concise view for January 15.')).toBeInTheDocument();
  });

  it('steps backwards from December 2026 to November 2026', async () => {
    const user = setUpUser();
    renderCalendar();

    await user.click(screen.getByRole('button', { name: 'Show November 2026' }));

    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeInTheDocument();
  });
});

describe('CalendarPage — the agenda', () => {
  it('describes the selected day while in day mode', () => {
    renderCalendar();

    expect(screen.getByText('A concise view for December 15.')).toBeInTheDocument();
  });

  it('widens to the surrounding week when the week toggle is pressed', async () => {
    const user = setUpUser();
    renderCalendar();

    await user.click(screen.getByRole('button', { name: 'Week' }));

    // 15 December 2026 is a Tuesday; Monday-first weeks put it in Dec 14-20.
    expect(screen.getByText('Simple week view for Dec 14 – Dec 20.')).toBeInTheDocument();
  });

  it('marks the active mode with aria-pressed', async () => {
    const user = setUpUser();
    renderCalendar();

    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Week' }));

    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('follows the day that was clicked', async () => {
    const user = setUpUser();
    renderCalendar();

    const targetCell = getDayCells().find((button) =>
      (button.getAttribute('aria-label') ?? '').startsWith('Friday, December 18, 2026'),
    );
    if (!targetCell) throw new Error('expected a cell for Friday 18 December 2026');

    await user.click(targetCell);

    expect(screen.getByText('A concise view for December 18.')).toBeInTheDocument();
  });

  it('shows the empty state when nothing lands on the selected day', () => {
    renderCalendar();

    expect(
      screen.getByRole('heading', { name: 'Nothing is on the daily agenda' }),
    ).toBeInTheDocument();
  });
});

// Everything above pins a month the fixtures never reach, so it exercises the
// page's structure against empty data. This block pins a day that fixture data
// actually lands on, which is the only way to cover the
// fixture -> store -> selector -> route path end to end.
//
// Sunday 16 August 2026 carries two due tasks ("Go for a run", "Read 20 pages")
// and one habit completion. Its Monday-first week, 10-16 August, also contains
// "Finish portfolio landing page" (due the 14th) and "Buy groceries" (the 15th).
const augustNow = new Date(2026, 7, 16, 12, 0, 0);

describe('CalendarPage — a day the fixtures reach', () => {
  beforeEach(() => {
    vi.setSystemTime(augustNow);
  });

  it('counts the day’s tasks and habit activity in the cell label', () => {
    renderCalendar();

    const label = getDayCellLabels().find((candidate) =>
      candidate.startsWith('Sunday, August 16, 2026'),
    );

    expect(label).toBe('Sunday, August 16, 2026. 2 due tasks. 1 habit check-in');
  });

  it('puts habit activity on the agenda next to the tasks', () => {
    renderCalendar();

    // Task titles render twice on a populated day — once in the "due today"
    // list and once as an agenda card — so this asserts on the habit item,
    // which only the agenda renders.
    expect(screen.getByRole('heading', { name: '1 habit check-in' })).toBeInTheDocument();
  });

  it('pulls in the rest of the week when the week toggle is pressed', async () => {
    const user = setUpUser();
    renderCalendar();

    // Due Friday 14 August: inside the selected week, outside the selected day.
    expect(
      screen.queryByRole('heading', { name: 'Finish portfolio landing page' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Week' }));

    expect(
      screen.getByRole('heading', { name: 'Finish portfolio landing page' }),
    ).toBeInTheDocument();
  });
});
