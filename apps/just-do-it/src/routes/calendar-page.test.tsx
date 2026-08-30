// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CalendarPage } from './calendar-page';

// Tuesday 15 December 2026. The calendar reads the real clock, so every test
// pins it — otherwise these assertions rot the moment the month turns.
const pinnedNow = new Date(2026, 11, 15);

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

  it('renders whole weeks, so the grid is a multiple of seven', () => {
    renderCalendar();

    expect(getDayCells()).toHaveLength(35);
  });

  it('starts the grid on the Monday before the first of the month', () => {
    renderCalendar();

    expect(getDayCellLabels()[0]).toMatch(/^Monday, November 30, 2026\./u);
  });

  it('ends the grid on the Sunday after the last of the month', () => {
    renderCalendar();

    expect(getDayCellLabels().at(-1)).toMatch(/^Sunday, January 3, 2027\./u);
  });

  it('spills into both adjacent months rather than clipping to December', () => {
    renderCalendar();

    const labels = getDayCellLabels();

    // The label reads "Monday, November 30, 2026. …", so the month and year are
    // not adjacent — match the month name and the year separately.
    expect(labels.some((label) => /November \d+, 2026/u.test(label))).toBe(true);
    expect(labels.some((label) => /January \d+, 2027/u.test(label))).toBe(true);
  });
});

describe('CalendarPage — month navigation', () => {
  it('crosses the year boundary from December 2026 to January 2027', async () => {
    const user = setUpUser();
    renderCalendar();

    await user.click(screen.getByRole('button', { name: 'Show January 2027' }));

    expect(screen.getByRole('heading', { name: 'January 2027' })).toBeInTheDocument();
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
});
