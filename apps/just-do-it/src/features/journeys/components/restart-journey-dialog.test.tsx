// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RestartJourneyDialog } from './restart-journey-dialog';

// The dialog reads `new Date()` for "today", so the clock is pinned — at midday,
// so `shouldAdvanceTime` cannot creep it over midnight.
const pinnedNow = new Date(2026, 10, 19, 12, 0, 0);
const TITLE = '100-Day Discipline Challenge';

function setUpUser() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

function renderDialog(overrides: Partial<Parameters<typeof RestartJourneyDialog>[0]> = {}): {
  onCancel: ReturnType<typeof vi.fn>;
  onRestart: ReturnType<typeof vi.fn>;
} {
  const onCancel = vi.fn();
  const onRestart = vi.fn(async () => {});

  render(
    <RestartJourneyDialog
      completedCount={2}
      error={null}
      journeyTitle={TITLE}
      onCancel={onCancel}
      onRestart={onRestart}
      {...overrides}
    />,
  );

  return {
    onCancel: (overrides.onCancel as ReturnType<typeof vi.fn>) ?? onCancel,
    onRestart: (overrides.onRestart as ReturnType<typeof vi.fn>) ?? onRestart,
  };
}

function dateField(): HTMLInputElement {
  return screen.getByLabelText('Start date') as HTMLInputElement;
}

function restartButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Restart' });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(pinnedNow);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('RestartJourneyDialog', () => {
  it('is a modal dialog named after the journey', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog', { name: `Restart ${TITLE}?` });

    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('starts today unless told otherwise', async () => {
    const user = setUpUser();
    const { onRestart } = renderDialog();

    expect(screen.getByRole('radio', { name: 'Start today' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Start on a date' })).not.toBeChecked();
    expect(dateField()).toBeDisabled();

    await user.click(restartButton());

    expect(onRestart).toHaveBeenCalledWith('2026-11-19');
  });

  it('moves focus into the dialog, onto the chosen option', () => {
    renderDialog();

    expect(screen.getByRole('radio', { name: 'Start today' })).toHaveFocus();
  });

  it('restarts on a chosen date', async () => {
    const user = setUpUser();
    const { onRestart } = renderDialog();

    await user.click(screen.getByRole('radio', { name: 'Start on a date' }));

    expect(dateField()).toBeEnabled();

    // jsdom cannot type into a date input; a change event is the honest way.
    fireEvent.change(dateField(), { target: { value: '2026-12-01' } });
    await user.click(restartButton());

    expect(onRestart).toHaveBeenCalledWith('2026-12-01');
  });

  it('says what will be cleared and when day 1 lands', async () => {
    const user = setUpUser();

    renderDialog({ completedCount: 7 });

    expect(
      screen.getByText(
        "This clears the 7 activities you've ticked on this run and starts day 1 on 19 Nov 2026. It can't be undone.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Start on a date' }));
    fireEvent.change(dateField(), { target: { value: '2026-12-01' } });

    expect(screen.getByText(/starts day 1 on 1 Dec 2026/)).toBeInTheDocument();
  });

  it('counts a single activity in the singular', () => {
    renderDialog({ completedCount: 1 });

    expect(screen.getByText(/clears the 1 activity you've ticked/)).toBeInTheDocument();
  });

  it('leaves the count out when nothing has been ticked', () => {
    renderDialog({ completedCount: 0 });

    expect(screen.queryByText(/you've ticked/)).not.toBeInTheDocument();
    expect(screen.getByText('Day 1 will be 19 Nov 2026.')).toBeInTheDocument();
  });

  it('refuses to restart without a date', async () => {
    const user = setUpUser();
    const { onRestart } = renderDialog();

    await user.click(screen.getByRole('radio', { name: 'Start on a date' }));
    fireEvent.change(dateField(), { target: { value: '' } });

    expect(restartButton()).toBeDisabled();
    expect(screen.getByText('Pick a start date.')).toBeInTheDocument();

    await user.click(restartButton());

    expect(onRestart).not.toHaveBeenCalled();
  });

  it('goes back to today when the date option is abandoned', async () => {
    const user = setUpUser();
    const { onRestart } = renderDialog();

    await user.click(screen.getByRole('radio', { name: 'Start on a date' }));
    fireEvent.change(dateField(), { target: { value: '' } });
    await user.click(screen.getByRole('radio', { name: 'Start today' }));

    expect(restartButton()).toBeEnabled();

    await user.click(restartButton());

    expect(onRestart).toHaveBeenCalledWith('2026-11-19');
  });

  it('disables both buttons while the restart is in flight', async () => {
    const user = setUpUser();
    let finish: () => void = () => {};
    const onRestart = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );

    renderDialog({ onRestart });

    await user.click(restartButton());

    expect(screen.getByRole('button', { name: 'Restarting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(onRestart).toHaveBeenCalledTimes(1);

    finish();

    expect(await screen.findByRole('button', { name: 'Restart' })).toBeEnabled();
  });

  it('cancels from the button and from Escape', async () => {
    const user = setUpUser();
    const { onCancel } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('shows an error it is handed', () => {
    renderDialog({ error: 'Could not restart. Nothing was changed.' });

    expect(screen.getByRole('alert')).toHaveTextContent('Could not restart. Nothing was changed.');
  });
});
