import { describe, expect, it, vi } from 'vitest';

import { NAVIGATION_CHORDS, buildCommands } from './commands';

function build() {
  const navigate = vi.fn();
  const toggleTheme = vi.fn();

  return { commands: buildCommands({ navigate, toggleTheme }), navigate, toggleTheme };
}

describe('buildCommands — navigation', () => {
  it('offers every top-level route', () => {
    const { commands } = build();
    const labels = commands.filter((item) => item.group === 'Navigate').map((item) => item.label);

    expect(labels).toEqual([
      'Today',
      'Tasks',
      'Calendar',
      'Goals',
      'Habits',
      'Books',
      'Lists',
      'Settings',
    ]);
  });

  it('navigates to the matching path when run', () => {
    const { commands, navigate } = build();

    commands.find((item) => item.label === 'Calendar')?.run();

    expect(navigate).toHaveBeenCalledWith('/calendar');
  });

  it('shows the keyboard chord as a hint', () => {
    const { commands } = build();

    expect(commands.find((item) => item.label === 'Tasks')?.hint).toBe('g k');
  });

  // The palette and the chord handler must not drift apart: every route the
  // palette offers should be reachable by its advertised chord.
  it('advertises a chord that NAVIGATION_CHORDS actually maps', () => {
    const { commands } = build();

    for (const item of commands.filter((command) => command.group === 'Navigate')) {
      const chordKey = item.hint?.replace('g ', '');

      expect(chordKey).toBeDefined();
      expect(NAVIGATION_CHORDS[chordKey as string]).toBeDefined();
    }
  });
});

describe('buildCommands — actions', () => {
  it('offers creating a task and toggling the theme', () => {
    const { commands } = build();
    const labels = commands.filter((item) => item.group === 'Actions').map((item) => item.label);

    expect(labels).toEqual(['New task…', 'Toggle dark mode']);
  });

  it('toggles the theme when run', () => {
    const { commands, toggleTheme } = build();

    commands.find((item) => item.label === 'Toggle dark mode')?.run();

    expect(toggleTheme).toHaveBeenCalled();
  });

  // The one command that does not close the palette: it switches it into
  // quick-add mode, which is why `run` returns a mode rather than void.
  it('switches into new-task mode rather than closing', () => {
    const { commands } = build();

    expect(commands.find((item) => item.label === 'New task…')?.run()).toBe('new-task');
  });

  it('returns nothing from the commands that should close the palette', () => {
    const { commands } = build();

    expect(commands.find((item) => item.label === 'Today')?.run()).toBeUndefined();
    expect(commands.find((item) => item.label === 'Toggle dark mode')?.run()).toBeUndefined();
  });

  it('gives every command a distinct id', () => {
    const { commands } = build();

    expect(new Set(commands.map((item) => item.id)).size).toBe(commands.length);
  });
});
