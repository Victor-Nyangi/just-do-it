import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';

// Reachable by editing the URL, and by leaving a journey while looking at it.
export function JourneyNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-8">
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--muted-foreground)]">
          <Compass aria-hidden="true" className="size-6" />
        </div>
        <h1 className="mt-4 text-lg font-bold">This journey is not in your list</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          It may have been left, or the link may point at an enrollment that no longer exists.
        </p>
        <Link
          className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary-hover)]"
          to="/journeys"
        >
          Browse journeys
        </Link>
      </div>
    </div>
  );
}
