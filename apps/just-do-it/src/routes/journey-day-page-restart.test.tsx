// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useJourneyStore } from '../features/journeys';
import type { JourneyRestartResult } from '../features/sync';
import { JourneyDayPage } from './journey-day-page';

// The two ways a restart can go wrong only happen against a server, and this
// build has none — so the synced hook is replaced here and made to answer as a
// failing server would. What is under test is how the page reports each one.
const restartMock =
  vi.fn<(enrollmentId: string, startDate: string) => Promise<JourneyRestartResult>>();

vi.mock('../features/sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../features/sync')>();

  return { ...actual, useSyncedRestartEnrollment: () => restartMock };
});

const pinnedNow = new Date(2026, 8, 12, 12, 0, 0);
const ENROLLMENT_ID = 'enrollment-discipline';

function LocationProbe() {
  const location = useLocation();

  return <p data-testid="location">{location.pathname}</p>;
}

function renderDay() {
  return render(
    <MemoryRouter initialEntries={[`/journeys/${ENROLLMENT_ID}`]}>
      <Routes>
        <Route path="/journeys/:enrollmentId" element={<JourneyDayPage />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

async function restart(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Restart 100-Day Discipline Challenge' }));

  const dialog = screen.getByRole('dialog', { name: 'Restart 100-Day Discipline Challenge?' });

  await user.click(within(dialog).getByRole('button', { name: 'Restart' }));

  return dialog;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(pinnedNow);
  restartMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('JourneyDayPage — a restart that fails', () => {
  it('keeps the dialog open and says nothing changed when the new run is refused', async () => {
    restartMock.mockResolvedValue({ status: 'not-restarted' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderDay();

    const dialog = await restart(user);

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "Couldn't restart 100-Day Discipline Challenge. Nothing was changed, so you can try again.",
    );
    expect(within(dialog).getByRole('button', { name: 'Restart' })).toBeEnabled();
    expect(screen.getByTestId('location')).toHaveTextContent(`/journeys/${ENROLLMENT_ID}`);
  });

  it('treats a thrown restart the same way', async () => {
    restartMock.mockRejectedValue(new Error('network'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderDay();

    const dialog = await restart(user);

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/Nothing was changed/);
  });

  // The new run exists, so the page still follows it — but the person is told
  // the old one is still there rather than finding it later.
  it('moves to the new run and reports an old run it could not remove', async () => {
    restartMock.mockImplementation(async (_enrollmentId, startDate) => {
      const newId = useJourneyStore.getState().enrollInJourney('hundred-day-discipline', startDate);

      if (!newId) throw new Error('Expected the new run to be created');

      return { status: 'old-run-kept', enrollmentId: newId };
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderDay();

    await restart(user);

    const newId = useJourneyStore.getState().enrollments.at(-1)?.id;

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(`/journeys/${newId}`),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Started 100-Day Discipline Challenge again from 12 Sep 2026, but couldn't remove the old run.",
    );
  });
});
