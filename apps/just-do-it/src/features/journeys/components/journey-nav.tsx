import { ArrowLeft } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';

import { cn } from '@just-do-it/ui';

type JourneyNavProps = {
  enrollmentId: string;
};

function tabClassName(isActive: boolean) {
  return cn(
    'inline-flex h-9 flex-1 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:flex-none',
    isActive
      ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--card-shadow)]'
      : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
  );
}

// Every tab is scoped to the enrollment rather than to the journey: the same
// journey run twice is two separate sets of days and two separate histories.
export function JourneyNav({ enrollmentId }: JourneyNavProps) {
  const tabs = [
    { label: 'Today', to: `/journeys/${enrollmentId}`, end: true },
    { label: 'Books', to: `/journeys/${enrollmentId}/books`, end: false },
    { label: 'Streak', to: `/journeys/${enrollmentId}/streak`, end: false },
  ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <nav
        aria-label="Journey sections"
        className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-1"
      >
        {tabs.map((tab) => (
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

      <Link
        className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
        to="/journeys"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        All journeys
      </Link>
    </div>
  );
}
