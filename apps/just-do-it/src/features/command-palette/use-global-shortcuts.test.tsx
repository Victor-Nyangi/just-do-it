// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useGlobalShortcuts } from './use-global-shortcuts';

function Harness({
  onOpenPalette,
  onNavigate,
}: {
  onOpenPalette: () => void;
  onNavigate: (to: string) => void;
}) {
  useGlobalShortcuts({ onNavigate, onOpenPalette });

  return (
    <div>
      <label htmlFor="probe">Probe</label>
      <input id="probe" />
    </div>
  );
}

function setUpUser() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useGlobalShortcuts — opening the palette', () => {
  it('opens on meta+k', async () => {
    const user = setUpUser();
    const onOpenPalette = vi.fn();
    render(<Harness onNavigate={vi.fn()} onOpenPalette={onOpenPalette} />);

    await user.keyboard('{Meta>}k{/Meta}');

    expect(onOpenPalette).toHaveBeenCalled();
  });

  it('opens on control+k too, for non-Mac keyboards', async () => {
    const user = setUpUser();
    const onOpenPalette = vi.fn();
    render(<Harness onNavigate={vi.fn()} onOpenPalette={onOpenPalette} />);

    await user.keyboard('{Control>}k{/Control}');

    expect(onOpenPalette).toHaveBeenCalled();
  });

  // Modified, so it cannot collide with typing — it must work from inside a
  // text field.
  it('opens even while an input is focused', async () => {
    const user = setUpUser();
    const onOpenPalette = vi.fn();
    render(<Harness onNavigate={vi.fn()} onOpenPalette={onOpenPalette} />);

    await user.click(screen.getByLabelText('Probe'));
    await user.keyboard('{Meta>}k{/Meta}');

    expect(onOpenPalette).toHaveBeenCalled();
  });
});

describe('useGlobalShortcuts — navigation chords', () => {
  it('navigates on g then t', async () => {
    const user = setUpUser();
    const onNavigate = vi.fn();
    render(<Harness onNavigate={onNavigate} onOpenPalette={vi.fn()} />);

    await user.keyboard('gt');

    expect(onNavigate).toHaveBeenCalledWith('/today');
  });

  it('maps g k to tasks rather than to today', async () => {
    const user = setUpUser();
    const onNavigate = vi.fn();
    render(<Harness onNavigate={onNavigate} onOpenPalette={vi.fn()} />);

    await user.keyboard('gk');

    expect(onNavigate).toHaveBeenCalledWith('/tasks');
  });

  it('does nothing for g followed by an unmapped key', async () => {
    const user = setUpUser();
    const onNavigate = vi.fn();
    render(<Harness onNavigate={onNavigate} onOpenPalette={vi.fn()} />);

    await user.keyboard('gz');

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('forgets the pending g after the window closes', async () => {
    const user = setUpUser();
    const onNavigate = vi.fn();
    render(<Harness onNavigate={onNavigate} onOpenPalette={vi.fn()} />);

    await user.keyboard('g');
    vi.advanceTimersByTime(1500);
    await user.keyboard('t');

    expect(onNavigate).not.toHaveBeenCalled();
  });

  // The single most important guard: `g` is unmodified, so without this,
  // typing "goals" into any field would navigate away mid-word.
  it('ignores chords while an input is focused', async () => {
    const user = setUpUser();
    const onNavigate = vi.fn();
    render(<Harness onNavigate={onNavigate} onOpenPalette={vi.fn()} />);

    await user.click(screen.getByLabelText('Probe'));
    await user.keyboard('gt');

    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Probe')).toHaveValue('gt');
  });

  it('does not fire a chord when g is modified', async () => {
    const user = setUpUser();
    const onNavigate = vi.fn();
    render(<Harness onNavigate={onNavigate} onOpenPalette={vi.fn()} />);

    await user.keyboard('{Meta>}g{/Meta}t');

    expect(onNavigate).not.toHaveBeenCalled();
  });
});
