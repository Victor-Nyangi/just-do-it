// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildCompletionsFileContents,
  buildDayPlan,
  getInitialJourneyCompletions,
  useJourneyStore,
} from '../features/journeys';
import { JourneyStreakPage } from './journey-streak-page';

// Midday on day five. Far enough in that there are finished days behind, a day
// in hand, and ninety-five ahead — which is what makes every dot state
// reachable in one render.
const pinnedNow = new Date(2026, 8, 16, 12, 0, 0);
const ENROLLMENT_ID = 'enrollment-discipline';

function renderStreak(enrollmentId = ENROLLMENT_ID) {
  return render(
    <MemoryRouter initialEntries={[`/journeys/${enrollmentId}/streak`]}>
      <Routes>
        <Route path="/journeys/:enrollmentId/streak" element={<JourneyStreakPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// The fixture only seeds two completions on day one, so a test that needs
// finished days has to build them — through the store action, so the same
// guards the UI goes through apply here too.
function completeWholeDays(dayIndexes: readonly number[]) {
  const { journeys, enrollments, toggleActivityCompletion } = useJourneyStore.getState();
  const enrollment = enrollments.find((entry) => entry.id === ENROLLMENT_ID);
  const journey = journeys.find((entry) => entry.id === enrollment?.journeyId);

  if (!enrollment || !journey) throw new Error('Expected the seeded enrollment');

  for (const dayIndex of dayIndexes) {
    for (const activity of buildDayPlan(journey, enrollment, dayIndex)?.activities ?? []) {
      const alreadyDone = useJourneyStore
        .getState()
        .completions.some((completion) => completion.activityId === activity.id);

      if (!alreadyDone) {
        toggleActivityCompletion(ENROLLMENT_ID, dayIndex, activity.id);
      }
    }
  }
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(pinnedNow);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('JourneyStreakPage — the stats cards', () => {
  it('places the day within the journey', () => {
    renderStreak();

    expect(screen.getByText('Day 5 of 100, with 95 still to go.')).toBeInTheDocument();
  });

  it('starts every streak at zero when nothing has been finished', () => {
    renderStreak();

    const currentStreak = screen.getByText('Current streak').closest('div');

    expect(within(currentStreak as HTMLElement).getByText('0')).toBeInTheDocument();
  });

  it('counts a run of finished days', () => {
    completeWholeDays([1, 2, 3, 4]);
    renderStreak();

    const currentStreak = screen.getByText('Current streak').closest('div');
    const longestStreak = screen.getByText('Longest streak').closest('div');

    expect(within(currentStreak as HTMLElement).getByText('4')).toBeInTheDocument();
    expect(within(longestStreak as HTMLElement).getByText('4')).toBeInTheDocument();
  });

  it('counts the days finished against the days elapsed', () => {
    completeWholeDays([1, 2]);
    renderStreak();

    expect(screen.getByText('Out of 5 elapsed')).toBeInTheDocument();
  });

  it('counts the activities done against the whole journey', () => {
    renderStreak();

    expect(screen.getByText('Of 486 across the journey')).toBeInTheDocument();
    const activitiesDone = screen.getByText('Activities done').closest('div');
    expect(within(activitiesDone as HTMLElement).getByText('2')).toBeInTheDocument();
  });
});

describe('JourneyStreakPage — the activity map', () => {
  it('draws one dot per day of the journey', () => {
    renderStreak();

    const map = screen.getByRole('heading', { name: 'Activity map' }).closest('section');

    // The hundred day dots plus the five legend entries.
    expect(within(map as HTMLElement).getAllByRole('listitem')).toHaveLength(105);
  });

  // Each dot carries its own label rather than encoding the day purely as a
  // background colour, so the map is readable without seeing it.
  it('labels a finished day, a missed one and one still ahead', () => {
    completeWholeDays([1]);
    renderStreak();

    expect(
      screen.getByRole('listitem', { name: 'Day 1, 12 Sep 2026 — complete' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('listitem', { name: 'Day 2, 13 Sep 2026 — missed' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('listitem', { name: 'Day 40, 21 Oct 2026 — upcoming' }),
    ).toBeInTheDocument();
  });

  // A missed day and the day still in hand have both done nothing, so the
  // counts alone cannot tell them apart — only the status word can.
  it('tells the day in progress apart from a day that was missed', () => {
    renderStreak();

    expect(
      screen.getByRole('listitem', { name: 'Day 5, 16 Sep 2026 — in progress, nothing done yet' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('listitem', { name: 'Day 4, 15 Sep 2026 — missed' }),
    ).toBeInTheDocument();
  });

  it('labels a partly finished day with how far it got', () => {
    useJourneyStore.getState().toggleActivityCompletion(ENROLLMENT_ID, 2, 'day-2-reflection');
    renderStreak();

    expect(
      screen.getByRole('listitem', { name: 'Day 2, 13 Sep 2026 — 1 of 5 done' }),
    ).toBeInTheDocument();
  });

  it('draws a shorter journey to its own length', () => {
    const enrollmentId = useJourneyStore
      .getState()
      .enrollInJourney('deep-work-reset', '2026-09-12');

    if (!enrollmentId) throw new Error('Expected an enrollment');

    renderStreak(enrollmentId);

    const map = screen.getByRole('heading', { name: 'Activity map' }).closest('section');

    // Thirty day dots plus the five legend entries.
    expect(within(map as HTMLElement).getAllByRole('listitem')).toHaveLength(35);
  });

  it('explains what the colours mean', () => {
    renderStreak();

    for (const label of ['Complete', 'Partly done', 'In progress', 'Missed', 'Upcoming']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});

describe('JourneyStreakPage — the breakdown', () => {
  // Three of the four categories total 100, so each count has to be read inside
  // its own card rather than off the page.
  function categoryCount(category: string): string {
    const heading = screen.getByRole('heading', { name: category });

    return (
      within(heading.closest('div') as HTMLElement).getByText(/^\d+ of \d+$/).textContent ?? ''
    );
  }

  it('counts each category against its own total', () => {
    renderStreak();

    expect(categoryCount('Reflection')).toBe('0 of 100');
    expect(categoryCount('Technical reading')).toBe('1 of 100');
    expect(categoryCount('Physical')).toBe('1 of 186');
  });

  it('moves a category when one of its activities is completed', () => {
    useJourneyStore.getState().toggleActivityCompletion(ENROLLMENT_ID, 2, 'day-2-reflection');
    renderStreak();

    expect(categoryCount('Reflection')).toBe('1 of 100');
  });

  // A reading-only journey should not show an empty physical card.
  it('omits a category the journey never schedules', () => {
    const enrollmentId = useJourneyStore
      .getState()
      .enrollInJourney('deep-work-reset', '2026-09-12');

    if (!enrollmentId) throw new Error('Expected an enrollment');

    renderStreak(enrollmentId);

    expect(screen.queryByRole('heading', { name: 'Physical' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Technical reading' })).toBeInTheDocument();
  });

  it('reports overall progress across every activity', () => {
    renderStreak();

    expect(screen.getByRole('progressbar', { name: 'Overall journey progress' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
    expect(screen.getByText('2 of 486 activities ticked off.')).toBeInTheDocument();
  });
});

describe('JourneyStreakPage — publishing progress', () => {
  it('reports a clean browser as matching the repo', () => {
    renderStreak();

    expect(screen.getByText('Matches the repo')).toBeInTheDocument();
  });

  it('counts a local tick as something left to commit', () => {
    useJourneyStore.getState().toggleActivityCompletion(ENROLLMENT_ID, 2, 'day-2-reflection');
    renderStreak();

    expect(screen.getByText('1 uncommitted change')).toBeInTheDocument();
  });

  it('counts an undone tick too, and pluralises', () => {
    const { toggleActivityCompletion } = useJourneyStore.getState();

    toggleActivityCompletion(ENROLLMENT_ID, 2, 'day-2-reflection');
    toggleActivityCompletion(ENROLLMENT_ID, 1, 'day-1-walk-1km');
    renderStreak();

    expect(screen.getByText('2 uncommitted changes')).toBeInTheDocument();
  });

  // The button is the daily loop: copy, paste over the file, commit.
  // `userEvent.setup()` installs its own clipboard stub, so the copy is read
  // back through that rather than through a spy — overriding navigator.clipboard
  // beforehand just gets replaced by setup().
  it('copies the file contents to the clipboard', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    useJourneyStore.getState().toggleActivityCompletion(ENROLLMENT_ID, 2, 'day-2-reflection');
    renderStreak();

    await user.click(screen.getByRole('button', { name: /Copy file contents/ }));

    const written = JSON.parse(await navigator.clipboard.readText());

    expect(written.map((entry: { activityId: string }) => entry.activityId)).toEqual([
      'day-1-technical-reading',
      'day-1-walk-1km',
      'day-2-reflection',
    ]);
  });

  it('confirms the copy on the button itself', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderStreak();
    await user.click(screen.getByRole('button', { name: /Copy file contents/ }));

    expect(screen.getByRole('button', { name: /Copied/ })).toBeInTheDocument();
  });

  // Signed in, the store holds D1's rows and D1 owns the enrollment id, so the
  // run on screen is not `enrollment-discipline`. Exporting those rows verbatim
  // would write completions pointing at an enrollment the repo has never heard
  // of, and `journey-data.ts` throws on that at module load — the paste would
  // white-screen the deployed app rather than fail a test.
  it('publishes a server-owned run under the committed enrollment id', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const serverEnrollment = {
      id: 'c2f0e6a4-0000-4000-8000-000000000000',
      journeyId: 'hundred-day-discipline',
      startDate: '2026-09-12',
      createdAt: '2026-09-12T06:00:00.000Z',
    };

    useJourneyStore.getState().adoptServerState(
      [serverEnrollment],
      getInitialJourneyCompletions().map((entry) => ({
        ...entry,
        id: `${serverEnrollment.id}:${entry.dayIndex}:${entry.activityId}`,
        enrollmentId: serverEnrollment.id,
      })),
    );
    renderStreak(serverEnrollment.id);

    expect(screen.getByText('Matches the repo')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Copy file contents/ }));

    expect(await navigator.clipboard.readText()).toBe(
      buildCompletionsFileContents(getInitialJourneyCompletions()),
    );
  });

  // Day numbers are what cross over, so a run that began on another date would
  // publish its day one as the repo's day one — a different calendar day.
  it('warns when the run and the published record start on different dates', () => {
    const enrollmentId = useJourneyStore
      .getState()
      .enrollInJourney('hundred-day-discipline', '2026-10-01');

    if (!enrollmentId) throw new Error('Expected an enrollment');

    renderStreak(enrollmentId);

    expect(screen.getByText(/started on 2026-10-01/)).toBeInTheDocument();
    expect(screen.getByText(/published record starts on 2026-09-12/)).toBeInTheDocument();
  });

  // A journey the repo publishes no run of has nothing to paste over.
  it('offers no export for a run the repository does not publish', () => {
    const enrollmentId = useJourneyStore
      .getState()
      .enrollInJourney('deep-work-reset', '2026-09-12');

    if (!enrollmentId) throw new Error('Expected an enrollment');

    renderStreak(enrollmentId);

    expect(screen.queryByRole('button', { name: /Copy file contents/ })).not.toBeInTheDocument();
    expect(screen.getByText(/This run is yours alone/)).toBeInTheDocument();
  });

  it('resets back to the committed record', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    useJourneyStore.getState().toggleActivityCompletion(ENROLLMENT_ID, 2, 'day-2-reflection');
    renderStreak();

    await user.click(
      screen.getByRole('button', { name: 'Discard local changes and reload the committed record' }),
    );

    expect(screen.getByText('Matches the repo')).toBeInTheDocument();
  });
});

describe('JourneyStreakPage — framing', () => {
  it('scopes its section links to the enrollment', () => {
    renderStreak();

    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute(
      'href',
      `/journeys/${ENROLLMENT_ID}`,
    );
  });

  it('drops the day counter once the journey has closed', () => {
    vi.setSystemTime(new Date(2027, 0, 5, 12));
    renderStreak();

    expect(screen.getByText('All 100 days, and how each one went.')).toBeInTheDocument();
  });

  it('explains itself when the enrollment does not exist', () => {
    renderStreak('nope');

    expect(
      screen.getByRole('heading', { name: 'This journey is not in your list' }),
    ).toBeInTheDocument();
  });
});
