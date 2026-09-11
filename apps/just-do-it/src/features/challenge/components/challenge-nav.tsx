import { NavLink } from 'react-router-dom';

import { cn } from '@just-do-it/ui';

const CHALLENGE_TABS = [
  { label: 'Today', to: '/challenge', end: true },
  { label: 'Books', to: '/challenge/books', end: false },
  { label: 'Streak', to: '/challenge/streak', end: false },
] as const;

function tabClassName(isActive: boolean) {
  return cn(
    'inline-flex h-9 flex-1 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:flex-none',
    isActive
      ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--card-shadow)]'
      : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
  );
}

export function ChallengeNav() {
  return (
    <nav
      aria-label="Challenge sections"
      className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-1"
    >
      {CHALLENGE_TABS.map((tab) => (
        <NavLink
          className={({ isActive }) => tabClassName(isActive)}
          end={tab.end}
          key={tab.to}
          to={tab.to}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
