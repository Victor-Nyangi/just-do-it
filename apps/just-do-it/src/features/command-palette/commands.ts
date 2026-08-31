import type { CommandItem } from './types';

// The single source of truth for `g`-then-key navigation. `buildCommands`
// advertises these as hints and `useGlobalShortcuts` dispatches them, so a
// route can never be offered under a chord that does not work.
//
// `g k` for Tasks because Today claims `t`.
export const NAVIGATION_CHORDS: Readonly<Record<string, string>> = {
  t: '/today',
  k: '/tasks',
  c: '/calendar',
  g: '/goals',
  h: '/habits',
  b: '/books',
  l: '/lists',
  s: '/settings',
};

const NAVIGATION_LABELS: Readonly<Record<string, string>> = {
  '/today': 'Today',
  '/tasks': 'Tasks',
  '/calendar': 'Calendar',
  '/goals': 'Goals',
  '/habits': 'Habits',
  '/books': 'Books',
  '/lists': 'Lists',
  '/settings': 'Settings',
};

// Sidebar order, which is the order a user has already learned, rather than the
// alphabetical order of the chord keys.
const NAVIGATION_ORDER = [
  '/today',
  '/tasks',
  '/calendar',
  '/goals',
  '/habits',
  '/books',
  '/lists',
  '/settings',
] as const;

function findChordFor(path: string): string | undefined {
  const entry = Object.entries(NAVIGATION_CHORDS).find(([, chordPath]) => chordPath === path);

  return entry?.[0];
}

export function buildCommands({
  navigate,
  toggleTheme,
}: {
  navigate: (to: string) => void;
  toggleTheme: () => void;
}): readonly CommandItem[] {
  const navigationCommands: CommandItem[] = NAVIGATION_ORDER.map((path) => {
    const chordKey = findChordFor(path);

    return {
      id: `navigate:${path}`,
      group: 'Navigate',
      label: NAVIGATION_LABELS[path] ?? path,
      hint: chordKey ? `g ${chordKey}` : undefined,
      run: () => {
        navigate(path);
      },
    };
  });

  return [
    ...navigationCommands,
    {
      id: 'action:new-task',
      group: 'Actions',
      label: 'New task…',
      run: () => 'new-task' as const,
    },
    {
      id: 'action:toggle-theme',
      group: 'Actions',
      label: 'Toggle dark mode',
      run: () => {
        toggleTheme();
      },
    },
  ];
}
