// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EXAMPLE_JOURNEY_COMPLETIONS } from '../../test/journey-baseline';
import { useJourneyStore } from '../journeys';
import { useSyncedEnrollInJourney, useSyncedLeaveJourney, useSyncedToggleActivity } from './hooks';
import { JourneySync } from './journey-sync';

// This build has no VITE_API_URL and no Clerk key — Vite inlines both, so a test
// cannot change them. That makes this the local-only path, which is the one
// that has to keep working for a portfolio visitor and for any deploy where a
// variable was missing at build time. The synced hooks must be transparent
// there: same behaviour as the raw store actions, and no network at all.
const ENROLLMENT_ID = 'enrollment-discipline';

function ToggleButton() {
  const toggle = useSyncedToggleActivity();

  return (
    <button onClick={() => toggle(ENROLLMENT_ID, 1, 'day-1-reflection')} type="button">
      Toggle
    </button>
  );
}

function EnrollButton({ onResult }: { onResult: (id: string | null) => void }) {
  const enroll = useSyncedEnrollInJourney();

  return (
    <button
      onClick={() => {
        void enroll('deep-work-reset', '2026-10-01').then(onResult);
      }}
      type="button"
    >
      Enrol
    </button>
  );
}

function LeaveButton() {
  const leave = useSyncedLeaveJourney();

  return (
    <button onClick={() => leave(ENROLLMENT_ID)} type="button">
      Leave
    </button>
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the synced hooks with no API configured', () => {
  it('toggles locally', async () => {
    const user = userEvent.setup();

    render(<ToggleButton />);
    await user.click(screen.getByRole('button', { name: 'Toggle' }));

    expect(
      useJourneyStore
        .getState()
        .completions.some((completion) => completion.activityId === 'day-1-reflection'),
    ).toBe(true);
  });

  // The point of the fallback: no key or no API URL must mean no requests at
  // all, not failed ones.
  it('makes no network request', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const user = userEvent.setup();

    render(<ToggleButton />);
    await user.click(screen.getByRole('button', { name: 'Toggle' }));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('enrols locally and returns the local id', async () => {
    const user = userEvent.setup();
    const seen: (string | null)[] = [];

    render(<EnrollButton onResult={(id) => seen.push(id)} />);
    await user.click(screen.getByRole('button', { name: 'Enrol' }));

    expect(seen[0]).toBeTruthy();
    expect(useJourneyStore.getState().enrollments.some((entry) => entry.id === seen[0])).toBe(true);
  });

  it('leaves locally, taking the completions with it', async () => {
    const user = userEvent.setup();

    render(<LeaveButton />);
    await user.click(screen.getByRole('button', { name: 'Leave' }));

    expect(useJourneyStore.getState().enrollments).toHaveLength(0);
    expect(useJourneyStore.getState().completions).toHaveLength(0);
  });
});

describe('JourneySync with no API configured', () => {
  it('renders its children and leaves the local record alone', () => {
    render(
      <JourneySync>
        <p>The app</p>
      </JourneySync>,
    );

    expect(screen.getByText('The app')).toBeInTheDocument();
    expect(useJourneyStore.getState().completions).toEqual(EXAMPLE_JOURNEY_COMPLETIONS);
  });

  it('does not try to hydrate', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    render(
      <JourneySync>
        <p>The app</p>
      </JourneySync>,
    );

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('adopting server state', () => {
  // The hydration path itself, driven through the store action the sync
  // component calls — the component cannot be driven end to end here, because
  // signing in needs a Clerk key this build does not have.
  it('replaces what a person has done, and not the journey definitions', () => {
    const journeysBefore = useJourneyStore.getState().journeys;

    useJourneyStore.getState().adoptServerState(
      [
        {
          id: 'from-server',
          journeyId: 'hundred-day-discipline',
          startDate: '2026-09-11',
          createdAt: '2026-09-11T06:00:00.000Z',
        },
      ],
      [],
    );

    const state = useJourneyStore.getState();

    expect(state.enrollments.map((entry) => entry.id)).toEqual(['from-server']);
    expect(state.completions).toEqual([]);
    expect(state.journeys).toEqual(journeysBefore);
  });

  it('refuses rows that do not validate', () => {
    expect(() =>
      useJourneyStore.getState().adoptServerState([{ id: 'broken' } as never], []),
    ).toThrow();
  });

  it('adopting the same enrollment twice does not duplicate it', () => {
    const enrollment = {
      id: 'from-server',
      journeyId: 'deep-work-reset',
      startDate: '2026-10-01',
      createdAt: '2026-10-01T00:00:00.000Z',
    };

    useJourneyStore.getState().adoptEnrollment(enrollment);
    useJourneyStore.getState().adoptEnrollment(enrollment);

    expect(
      useJourneyStore.getState().enrollments.filter((entry) => entry.id === 'from-server'),
    ).toHaveLength(1);
  });
});
