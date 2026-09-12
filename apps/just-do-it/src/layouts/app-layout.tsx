import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  CircleHelp,
  Compass,
  Flame,
  Goal,
  LayoutDashboard,
  List,
  Menu,
  Moon,
  Settings,
  Sun,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { Button, cn } from '@just-do-it/ui';
import { SignInControl } from '../features/auth';
import { CommandPalette } from '../features/command-palette';
import { JourneySync } from '../features/sync';

const navigation = [
  { label: 'Today', to: '/today', icon: LayoutDashboard },
  { label: 'Journeys', to: '/journeys', icon: Compass },
  { label: 'Tasks', to: '/tasks', icon: CheckSquare },
  { label: 'Calendar', to: '/calendar', icon: CalendarDays },
  { label: 'Goals', to: '/goals', icon: Goal },
  { label: 'Habits', to: '/habits', icon: Flame },
  { label: 'Books', to: '/books', icon: BookOpen },
  { label: 'Lists', to: '/lists', icon: List },
];

function navigationLinkClass(isActive: boolean) {
  return cn(
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-[var(--primary-subtle)] text-[var(--primary)]'
      : 'text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]',
  );
}

export function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Navigating leaves the drawer covering the page it just moved to, so every
  // destination closes it on the way out. Harmless on desktop, where the drawer
  // is never open in the first place.
  function closeMobileNav() {
    setMobileNavOpen(false);
  }

  const sidebar = (
    <aside className="flex h-full w-72 flex-col border-r border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--primary)] text-lg font-black text-white">
          J
        </div>
        <span className="text-lg font-bold tracking-tight">Just Do It</span>
      </div>
      <nav className="space-y-1">
        {navigation.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            className={({ isActive }) => navigationLinkClass(isActive)}
            onClick={closeMobileNav}
            to={to}
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto space-y-1">
        <NavLink
          className={({ isActive }) => navigationLinkClass(isActive)}
          onClick={closeMobileNav}
          to="/settings"
        >
          <Settings aria-hidden="true" className="size-4" />
          Settings
        </NavLink>
        <a
          className={navigationLinkClass(false)}
          href="https://github.com"
          rel="noreferrer"
          target="_blank"
        >
          <CircleHelp aria-hidden="true" className="size-4" />
          Help & feedback
        </a>
      </div>
    </aside>
  );

  return (
    <JourneySync>
      <div className="min-h-screen bg-[var(--background)]">
        <div className="fixed inset-y-0 left-0 hidden lg:block">{sidebar}</div>
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              aria-label="Close navigation"
              className="absolute inset-0 bg-[var(--overlay)]"
              onClick={() => setMobileNavOpen(false)}
            />
            {/* Only as wide as the sidebar itself. As a full-width block this sat
              above the overlay button in paint order and swallowed every click
              meant to dismiss the drawer. */}
            <div className="relative h-full w-72">{sidebar}</div>
          </div>
        )}
        <main className="lg:pl-72">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[var(--background)]/90 px-4 backdrop-blur sm:px-8">
            <Button
              aria-label="Open navigation"
              className="lg:hidden"
              onClick={() => setMobileNavOpen(true)}
              variant="ghost"
            >
              <Menu aria-hidden="true" className="size-5" />
            </Button>
            <div className="hidden lg:block" />
            <div className="flex items-center gap-2">
              <Button
                aria-label={darkMode ? 'Use light theme' : 'Use dark theme'}
                onClick={() => setDarkMode((current) => !current)}
                variant="ghost"
              >
                {darkMode ? (
                  <Sun aria-hidden="true" className="size-5" />
                ) : (
                  <Moon aria-hidden="true" className="size-5" />
                )}
              </Button>
              <SignInControl />
            </div>
          </header>
          <Outlet />
        </main>
        <CommandPalette onToggleTheme={() => setDarkMode((current) => !current)} />
      </div>
    </JourneySync>
  );
}
