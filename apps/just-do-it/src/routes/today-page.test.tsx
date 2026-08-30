// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TodayPage } from './today-page';

// Sunday 16 August 2026, midday. Inside the fixtures' May-September window, and
// chosen because it splits the six fixture tasks across every lane at once:
//
//   overdue      Finish portfolio landing page   due 08-14, todo
//   due today    Read 20 pages                   due 08-16, todo
//   due today    Go for a run                    due 08-16, in_progress
//   flexible     Paint miniatures                no due date, todo
//   excluded     Buy groceries                   due 08-15, completed
//   excluded     Replace bike light battery      due 08-20, still in the future
//
// So four tasks are actionable and five are open overall. `TodayPage` reads
// `new Date()` on every render, so the clock has to be pinned for any of this
// to hold.
const pinnedNow = new Date(2026, 7, 16, 12, 0, 0);

function renderToday() {
  return render(
    <MemoryRouter>
      <TodayPage />
    </MemoryRouter>,
  );
}

function setUpUser() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

// Each task row carries a "Complete <title>" button, which is the only
// role-and-name handle on a task. Note what this can and cannot show: it proves
// a task is on the page, not which lane it sits in. The lane `<section>`s have
// no accessible name to scope a `within()` query to, so lane membership is
// asserted only indirectly, through the section headings and the counts.
function getCompleteButton(title: string) {
  return screen.getByRole('button', { name: `Complete ${title}` });
}

function queryCompleteButton(title: string) {
  return screen.queryByRole('button', { name: `Complete ${title}` });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(pinnedNow);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TodayPage — the header', () => {
  it('titles the page with the current date', () => {
    renderToday();

    expect(screen.getByRole('heading', { name: 'Sunday, August 16' })).toBeInTheDocument();
  });

  it('counts the actionable tasks, which is not the number of open tasks', () => {
    renderToday();

    expect(screen.getByText('4 actionable tasks to guide the day.')).toBeInTheDocument();
    expect(screen.getByText('5 open overall')).toBeInTheDocument();
  });
});

describe('TodayPage — which tasks reach the day', () => {
  it('shows the overdue, due-today and unscheduled work', () => {
    renderToday();

    expect(getCompleteButton('Finish portfolio landing page')).toBeInTheDocument();
    expect(getCompleteButton('Read 20 pages')).toBeInTheDocument();
    expect(getCompleteButton('Go for a run')).toBeInTheDocument();
    expect(getCompleteButton('Paint miniatures')).toBeInTheDocument();
  });

  it('leaves out a task that is already completed', () => {
    renderToday();

    expect(queryCompleteButton('Buy groceries')).not.toBeInTheDocument();
  });

  // Due 20 August, four days after the pinned clock. This is the assertion that
  // fails if the page ever starts showing all scheduled work rather than only
  // what is due by today.
  it('leaves out a task that is not due yet', () => {
    renderToday();

    expect(queryCompleteButton('Replace bike light battery')).not.toBeInTheDocument();
  });

  it('names each lane', () => {
    renderToday();

    expect(screen.getByRole('heading', { name: 'Overdue' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Due today' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Flexible' })).toBeInTheDocument();
  });

  // A lane swaps its description for an empty label when it holds nothing, and
  // that is the one signal that distinguishes the lanes from each other by
  // role-and-name queries alone. At this clock all three lanes are populated,
  // so all three descriptions show and no empty label does. Without this, a
  // change that dumped every task into a single lane would keep the counts,
  // the headings and the buttons intact and go unnoticed.
  it('populates all three lanes at this clock', () => {
    renderToday();

    expect(screen.getByText('Tackle these first to clear carried work.')).toBeInTheDocument();
    expect(screen.getByText('Scheduled for today and ready for focus.')).toBeInTheDocument();
    expect(screen.getByText('Useful wins that can fit around the day.')).toBeInTheDocument();

    expect(screen.queryByText('Nothing is overdue.')).not.toBeInTheDocument();
    expect(screen.queryByText('Nothing is due today.')).not.toBeInTheDocument();
    expect(screen.queryByText('No flexible tasks waiting.')).not.toBeInTheDocument();
  });
});

describe('TodayPage — completing a task', () => {
  it('drops the task off the day and lowers both counts', async () => {
    const user = setUpUser();
    renderToday();

    await user.click(getCompleteButton('Finish portfolio landing page'));

    expect(queryCompleteButton('Finish portfolio landing page')).not.toBeInTheDocument();
    expect(screen.getByText('3 actionable tasks to guide the day.')).toBeInTheDocument();
    expect(screen.getByText('4 open overall')).toBeInTheDocument();
  });
});

describe('TodayPage — habit check-in', () => {
  it('shows a habit already completed today as pressed', () => {
    renderToday();

    expect(
      screen.getByRole('button', { name: 'Mark Reading incomplete for today' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows a habit not yet completed today as unpressed', () => {
    renderToday();

    expect(
      screen.getByRole('button', { name: 'Mark Meditation complete for today' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('checks a habit in, which relabels the button and flips its pressed state', async () => {
    const user = setUpUser();
    renderToday();

    await user.click(screen.getByRole('button', { name: 'Mark Meditation complete for today' }));

    expect(
      screen.getByRole('button', { name: 'Mark Meditation incomplete for today' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('checks a habit back out again', async () => {
    const user = setUpUser();
    renderToday();

    await user.click(screen.getByRole('button', { name: 'Mark Reading incomplete for today' }));

    expect(screen.getByRole('button', { name: 'Mark Reading complete for today' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

describe('TodayPage — goal progress', () => {
  it('exposes the goal progress on a progressbar rather than in colour alone', () => {
    renderToday();

    const progressBar = screen.getByRole('progressbar', { name: 'Build momentum progress' });

    expect(progressBar).toHaveAttribute('aria-valuenow', '72');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
  });
});

// The Today route embeds QuickAddField, so this is the one place the two
// features meet. It is the only test in the suite that runs the whole path from
// typing to a re-rendered lane.
describe('TodayPage — adding a task from the dashboard', () => {
  it('puts a newly added task straight onto the day', async () => {
    const user = setUpUser();
    renderToday();

    await user.type(
      screen.getByRole('textbox', { name: 'Quick add task' }),
      'Refill the bird feeder',
    );
    await user.click(screen.getByRole('button', { name: 'Add task' }));

    expect(getCompleteButton('Refill the bird feeder')).toBeInTheDocument();
    expect(screen.getByText('5 actionable tasks to guide the day.')).toBeInTheDocument();
  });
});
