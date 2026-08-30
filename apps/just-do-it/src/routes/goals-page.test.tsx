// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useGoalStore } from '../features/goals';
import { GoalsPage } from './goals-page';

// Sunday 16 August 2026, midday. The board itself is date-free, but the
// composer seeds its target date from `addDays(new Date(), 30)`, so the clock
// has to be pinned for that default to be assertable.
//
// The four fixture goals, and the two fields the controls move:
//
//   Build momentum        72%   active
//   Finish 4 books        50%   active
//   Ship portfolio…       35%   paused
//   Complete 12 workouts 100%   completed
const pinnedNow = new Date(2026, 7, 16, 12, 0, 0);

// `focusComposer` calls `scrollIntoView`, which jsdom leaves undefined rather
// than stubbing — it has to be assigned, not spied on.
Element.prototype.scrollIntoView = vi.fn();

function renderGoals() {
  return render(
    <MemoryRouter>
      <GoalsPage />
    </MemoryRouter>,
  );
}

function setUpUser() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

// Every goal card repeats the same control names ("Update progress", the status
// buttons), so card-level queries are scoped to the card's `<li>`, located by
// the heading it contains rather than by index.
function getGoalCard(title: string) {
  const card = screen
    .getAllByRole('listitem')
    .find((candidate) => within(candidate).queryByRole('heading', { name: title }));
  if (!card) throw new Error(`expected a card for the goal ${title}`);

  return within(card);
}

// The composer repeats "Title" and "Description" from nothing else on the page,
// but scoping it keeps the intent obvious and survives future cards gaining
// labelled fields.
function getComposer() {
  const form = screen.getByLabelText('Title').closest('form');
  if (!form) throw new Error('expected the composer form');

  return within(form);
}

function findGoal(title: string) {
  return useGoalStore.getState().goals.find((goal) => goal.title === title);
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(pinnedNow);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GoalsPage — the board', () => {
  it('lists every goal regardless of status', () => {
    renderGoals();

    for (const title of [
      'Build momentum',
      'Finish 4 books',
      'Ship portfolio refresh',
      'Complete 12 workouts',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
  });

  it('counts what is in view and how many are done', () => {
    renderGoals();

    expect(
      screen.getByText('4 goals in view with inline progress and status controls.'),
    ).toBeInTheDocument();
    expect(screen.getByText('1 completed')).toBeInTheDocument();
  });

  it('exposes each goal’s progress on a progressbar, not colour alone', () => {
    renderGoals();

    expect(screen.getByRole('progressbar', { name: 'Build momentum progress' })).toHaveAttribute(
      'aria-valuenow',
      '72',
    );
  });

  it('marks the current status as pressed', () => {
    renderGoals();

    const card = getGoalCard('Ship portfolio refresh');

    expect(card.getByRole('button', { name: 'Paused' })).toHaveAttribute('aria-pressed', 'true');
    expect(card.getByRole('button', { name: 'Active' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('GoalsPage — nudging progress', () => {
  it('raises progress by ten', async () => {
    const user = setUpUser();
    renderGoals();

    await user.click(
      screen.getByRole('button', { name: 'Increase Build momentum progress by 10 percent' }),
    );

    expect(screen.getByRole('progressbar', { name: 'Build momentum progress' })).toHaveAttribute(
      'aria-valuenow',
      '82',
    );
    expect(findGoal('Build momentum')?.progress).toBe(82);
  });

  it('lowers progress by ten', async () => {
    const user = setUpUser();
    renderGoals();

    await user.click(
      screen.getByRole('button', { name: 'Decrease Build momentum progress by 10 percent' }),
    );

    expect(findGoal('Build momentum')?.progress).toBe(62);
  });

  // "Ship portfolio refresh" sits at 35, so three decreases reach 5 and a
  // fourth would go negative. Note where the clamp actually is: the route
  // passes `Math.max(goal.progress - 10, 0)`, but `normalizeGoalProgress` in
  // the store clamps to 0-100 anyway, so removing the route's copy changes
  // nothing (confirmed by mutation). This pins the outcome, not that line.
  it('does not go below zero', async () => {
    const user = setUpUser();
    renderGoals();

    const decrease = screen.getByRole('button', {
      name: 'Decrease Ship portfolio refresh progress by 10 percent',
    });
    for (let press = 0; press < 4; press += 1) {
      await user.click(decrease);
    }

    expect(findGoal('Ship portfolio refresh')?.progress).toBe(0);
  });

  // Knocking a completed goal below 100 reopens it, rather than leaving a
  // "Completed" badge on a goal that is no longer done.
  //
  // `handleProgressChange` has a branch for this, but it is not what makes it
  // work: `buildGoalRecord` already flips a previously-completed goal back to
  // active when its progress drops below 100. Deleting the route's branch
  // changes nothing observable (confirmed by mutation), so this test pins the
  // outcome rather than that branch.
  it('reopens a completed goal when its progress drops', async () => {
    const user = setUpUser();
    renderGoals();

    await user.click(
      screen.getByRole('button', { name: 'Decrease Complete 12 workouts progress by 10 percent' }),
    );

    expect(findGoal('Complete 12 workouts')).toMatchObject({ progress: 90, status: 'active' });
    expect(
      getGoalCard('Complete 12 workouts').getByRole('button', { name: 'Active' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('0 completed')).toBeInTheDocument();
  });
});

describe('GoalsPage — changing status', () => {
  // Un-completing a goal cannot leave it sitting at 100%, or the board would
  // show an active goal that is already finished. `handleStatusChange` knocks
  // it back to 95 — a hard-coded number, and the only place in the app that
  // invents a progress value. Unlike the reopening rule, the store does not do
  // this: `updateGoalStatus` alone would leave the goal active at 100.
  it('drops a completed goal below the line when it is reopened by hand', async () => {
    const user = setUpUser();
    renderGoals();

    await user.click(getGoalCard('Complete 12 workouts').getByRole('button', { name: 'Active' }));

    expect(findGoal('Complete 12 workouts')).toMatchObject({ progress: 95, status: 'active' });
  });

  it('does the same when a completed goal is paused', async () => {
    const user = setUpUser();
    renderGoals();

    await user.click(getGoalCard('Complete 12 workouts').getByRole('button', { name: 'Paused' }));

    expect(findGoal('Complete 12 workouts')).toMatchObject({ progress: 95, status: 'paused' });
  });

  // The counterpart: marking a goal complete drives it to 100 rather than
  // leaving it at whatever it was. That rule *is* the store's.
  it('drives a goal to one hundred when it is marked complete', async () => {
    const user = setUpUser();
    renderGoals();

    await user.click(getGoalCard('Build momentum').getByRole('button', { name: 'Completed' }));

    expect(findGoal('Build momentum')).toMatchObject({ progress: 100, status: 'completed' });
  });

  it('pauses an active goal from its card', async () => {
    const user = setUpUser();
    renderGoals();

    await user.click(getGoalCard('Build momentum').getByRole('button', { name: 'Paused' }));

    expect(findGoal('Build momentum')?.status).toBe('paused');
    expect(getGoalCard('Build momentum').getByRole('button', { name: 'Paused' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('GoalsPage — the composer', () => {
  it('seeds the target date thirty days out', () => {
    renderGoals();

    expect(getComposer().getByLabelText('Target date')).toHaveValue('2026-09-15');
  });

  it('creates a goal from the form', async () => {
    const user = setUpUser();
    renderGoals();

    await user.type(getComposer().getByLabelText('Title'), 'Learn to swim');
    await user.type(
      getComposer().getByLabelText('Description'),
      'Two sessions a week until it clicks.',
    );
    await user.click(screen.getByRole('button', { name: 'Create goal' }));

    expect(screen.getByRole('heading', { name: 'Learn to swim' })).toBeInTheDocument();
    expect(findGoal('Learn to swim')).toMatchObject({
      description: 'Two sessions a week until it clicks.',
      targetDate: '2026-09-15',
      status: 'active',
    });
  });

  // As on the books route, the `required` attribute on the description field is
  // what stops this: the form never submits, so `handleCreateGoal`'s own
  // four-field check is unreachable and deleting it changes nothing (confirmed
  // by mutation). This pins the native validation the user actually meets; the
  // window `error` listener covers the case where both layers went, since
  // `goalSchema` requires a description and would throw.
  it('refuses a goal with no description, without throwing', async () => {
    const user = setUpUser();
    const countBefore = useGoalStore.getState().goals.length;
    const uncaught: string[] = [];
    const recordError = (event: ErrorEvent) => {
      uncaught.push(String(event.error ?? event.message));
    };
    window.addEventListener('error', recordError);

    try {
      renderGoals();

      await user.type(getComposer().getByLabelText('Title'), 'Learn to swim');
      await user.click(screen.getByRole('button', { name: 'Create goal' }));

      expect(useGoalStore.getState().goals).toHaveLength(countBefore);
      expect(uncaught).toEqual([]);
    } finally {
      window.removeEventListener('error', recordError);
    }
  });

  it('clears the form after creating', async () => {
    const user = setUpUser();
    renderGoals();

    await user.type(getComposer().getByLabelText('Title'), 'Learn to swim');
    await user.type(getComposer().getByLabelText('Description'), 'Two sessions a week.');
    await user.click(screen.getByRole('button', { name: 'Create goal' }));

    expect(getComposer().getByLabelText('Title')).toHaveValue('');
    expect(getComposer().getByLabelText('Description')).toHaveValue('');
  });
});
