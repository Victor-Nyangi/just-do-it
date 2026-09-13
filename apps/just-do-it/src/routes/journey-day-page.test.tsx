// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildDayPlan,
  getInitialJourneyEnrollments,
  getInitialJourneys,
  useJourneyStore,
} from '../features/journeys';
import { EXAMPLE_JOURNEY_COMPLETIONS } from '../test/journey-baseline';
import { JourneyDayPage } from './journey-day-page';

// Friday 11 September 2026, midday — day one of the seeded enrollment, and
// midday rather than midnight so the clock creeping forward under
// `shouldAdvanceTime` cannot roll the date over. The page reads `new Date()` on
// render, so the clock has to be pinned.
//
// Day one carries five activities, two of which the baseline has already
// completed. Which movements a day asks for is generated from the journey
// definition rather than listed there, so the labels below are read off the plan
// instead of written out — editing the movements must not break these.
const pinnedNow = new Date(2026, 8, 12, 12, 0, 0);
const ENROLLMENT_ID = 'enrollment-discipline';

function planFor(dayIndex: number) {
  const [journey] = getInitialJourneys();
  const [enrollment] = getInitialJourneyEnrollments();
  const plan = buildDayPlan(journey, enrollment, dayIndex);

  if (!plan) throw new Error(`No plan for day ${dayIndex}`);

  return plan;
}

function activityFor(dayIndex: number, activityId: string) {
  const activity = planFor(dayIndex).activities.find((entry) => entry.id === activityId);

  if (!activity) throw new Error(`Day ${dayIndex} does not schedule ${activityId}`);

  return activity;
}

// The first activity the baseline has already ticked, and one it has not.
const seededDoneLabel = activityFor(1, EXAMPLE_JOURNEY_COMPLETIONS[0].activityId).label;
const untickedDay1 = planFor(1).activities.filter(
  (activity) =>
    !EXAMPLE_JOURNEY_COMPLETIONS.some((completion) => completion.activityId === activity.id),
);

// The route takes a dynamic segment, so it has to be mounted through
// Routes/Route with initialEntries — a bare MemoryRouter resolves no params.
function renderDay(enrollmentId = ENROLLMENT_ID) {
  return render(
    <MemoryRouter initialEntries={[`/journeys/${enrollmentId}`]}>
      <Routes>
        <Route path="/journeys/:enrollmentId" element={<JourneyDayPage />} />
        <Route path="/journeys" element={<p>Journeys list</p>} />
      </Routes>
    </MemoryRouter>,
  );
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

describe('JourneyDayPage — the day', () => {
  it('names the journey and counts the day out of its length', () => {
    renderDay();

    expect(screen.getByText('100-Day Discipline Challenge')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Day 1 of 100' })).toBeInTheDocument();
  });

  it('names the date in full', () => {
    renderDay();

    expect(screen.getByText('Saturday, 12 September 2026')).toBeInTheDocument();
  });

  it('shows how much of the day is done', () => {
    renderDay();

    expect(screen.getByText('2 of 5 done')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Day 1 progress' })).toHaveAttribute(
      'aria-valuenow',
      '40',
    );
  });

  it('scopes its section links to the enrollment', () => {
    renderDay();

    expect(screen.getByRole('link', { name: 'Books' })).toHaveAttribute(
      'href',
      `/journeys/${ENROLLMENT_ID}/books`,
    );
    expect(screen.getByRole('link', { name: 'All journeys' })).toHaveAttribute('href', '/journeys');
  });
});

describe('JourneyDayPage — the checklist', () => {
  it('groups the day into its four categories', () => {
    renderDay();

    for (const category of ['Physical', 'Technical reading', 'Growth reading', 'Reflection']) {
      expect(screen.getByRole('heading', { name: category })).toBeInTheDocument();
    }
  });

  it('offers the movements the day actually calls for', () => {
    renderDay();

    for (const activity of planFor(1).activities) {
      expect(screen.getByRole('button', { name: new RegExp(activity.label) })).toBeInTheDocument();
    }

    // A movement the shuffle dealt to another day is not on this one.
    const elsewhere = planFor(2).activities.find(
      (activity) =>
        activity.category === 'physical' &&
        !planFor(1).activities.some((entry) => entry.label === activity.label),
    );

    expect(elsewhere).toBeDefined();
    expect(
      screen.queryByRole('button', { name: new RegExp(elsewhere?.label ?? 'nothing') }),
    ).not.toBeInTheDocument();
  });

  it('separates what is done from what is not', () => {
    renderDay();

    expect(
      screen.getByRole('button', { name: `Mark ${seededDoneLabel} incomplete for day 1` }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'Mark Daily reflection complete for day 1' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('JourneyDayPage — ticking an activity', () => {
  it('relabels the activity and moves the count', async () => {
    const user = setUpUser();
    renderDay();

    await user.click(
      screen.getByRole('button', { name: 'Mark Daily reflection complete for day 1' }),
    );

    expect(
      screen.getByRole('button', { name: 'Mark Daily reflection incomplete for day 1' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('3 of 5 done')).toBeInTheDocument();
  });

  it('writes the completion through to the store against its enrollment', async () => {
    const user = setUpUser();
    renderDay();

    await user.click(
      screen.getByRole('button', { name: 'Mark Daily reflection complete for day 1' }),
    );

    expect(
      useJourneyStore
        .getState()
        .completions.find((completion) => completion.activityId === 'day-1-reflection'),
    ).toMatchObject({ enrollmentId: ENROLLMENT_ID });
  });

  it('calls the day complete once nothing is left', async () => {
    const user = setUpUser();
    renderDay();

    for (const activity of untickedDay1) {
      await user.click(
        screen.getByRole('button', { name: `Mark ${activity.label} complete for day 1` }),
      );
    }

    expect(screen.getByText('Day complete')).toBeInTheDocument();
  });
});

describe('JourneyDayPage — moving between days', () => {
  it('cannot go back past day one', () => {
    renderDay();

    expect(screen.getByRole('button', { name: 'Go to the previous day' })).toBeDisabled();
  });

  it('steps forward to the next day and its own rotation', async () => {
    const user = setUpUser();
    renderDay();

    await user.click(screen.getByRole('button', { name: 'Go to the next day' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Day 2 of 100' })).toBeInTheDocument();

    for (const activity of planFor(2).activities) {
      expect(
        screen.getByRole('button', { name: `Mark ${activity.label} complete for day 2` }),
      ).toBeInTheDocument();
    }
    expect(screen.getByText('0 of 5 done')).toBeInTheDocument();
  });

  it('offers a way back to today only once it has been left', async () => {
    const user = setUpUser();
    renderDay();

    expect(screen.queryByRole('button', { name: 'Back to today' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Go to the next day' }));
    await user.click(screen.getByRole('button', { name: 'Back to today' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Day 1 of 100' })).toBeInTheDocument();
  });
});

describe('JourneyDayPage — another journey entirely', () => {
  // The reading-only journey proves the page is driven by the definition rather
  // than by the shape the discipline challenge happens to have.
  it('renders a journey with no physical work and one reading track', () => {
    const enrollmentId = useJourneyStore
      .getState()
      .enrollInJourney('deep-work-reset', '2026-09-12');

    if (!enrollmentId) throw new Error('Expected an enrollment');

    renderDay(enrollmentId);

    expect(screen.getByRole('heading', { level: 1, name: 'Day 1 of 30' })).toBeInTheDocument();
    expect(screen.getByText('0 of 2 done')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Physical' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Growth reading' })).not.toBeInTheDocument();
  });
});

describe('JourneyDayPage — outside the window', () => {
  it('opens on day one and says the journey has not started', () => {
    vi.setSystemTime(new Date(2026, 7, 1, 12));
    renderDay();

    expect(screen.getByRole('heading', { level: 1, name: 'Day 1 of 100' })).toBeInTheDocument();
    expect(screen.getByText(/opens on Saturday, 12 September 2026/)).toBeInTheDocument();
  });

  it('opens on the last day once the journey has closed', () => {
    vi.setSystemTime(new Date(2027, 0, 5, 12));
    renderDay();

    expect(screen.getByRole('heading', { level: 1, name: 'Day 100 of 100' })).toBeInTheDocument();
    expect(screen.getByText(/closed on Sunday, 20 December 2026/)).toBeInTheDocument();
  });

  // Reachable by editing the URL, and by leaving a journey while looking at it.
  it('explains itself when the enrollment does not exist', () => {
    renderDay('nope');

    expect(
      screen.getByRole('heading', { name: 'This journey is not in your list' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse journeys' })).toHaveAttribute(
      'href',
      '/journeys',
    );
  });
});
