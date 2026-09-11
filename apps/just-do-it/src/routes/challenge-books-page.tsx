import { BookOpen, Brain } from 'lucide-react';

import { Badge, Card } from '@just-do-it/ui';
import {
  ChallengeNav,
  ChallengeProgressBar,
  selectBookProgressForTrack,
  selectBookProgressList,
  useChallenge,
  useChallengeBooks,
  useChallengeCompletions,
  type ChallengeBookProgress,
  type ChallengeBookTrack,
} from '../features/challenge';

const TRACK_LABELS: Readonly<Record<ChallengeBookTrack, string>> = {
  technical: 'Technical reading',
  growth: 'Personal growth reading',
};

const TRACK_ICONS = {
  technical: BookOpen,
  growth: Brain,
} as const;

function BookProgressCard({ entry }: { entry: ChallengeBookProgress }) {
  const { book } = entry;
  const finished = entry.pagesRead >= book.pageCount;

  return (
    <Card className="flex h-full flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold">{book.title}</h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{book.author}</p>
        </div>
        {finished ? <Badge tone="success">Finished</Badge> : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-[var(--muted-foreground)]">
            {entry.pagesRead} of {book.pageCount} pages
          </span>
          <span className="text-sm font-semibold">{entry.progress}%</span>
        </div>
        <ChallengeProgressBar
          label={`${book.title} progress`}
          tone={finished ? 'primary' : 'accent'}
          value={entry.progress}
        />
      </div>

      <dl className="mt-auto grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-[var(--muted-foreground)]">Sessions done</dt>
          <dd className="mt-1 font-semibold">
            {entry.sessionsCompleted} of {entry.sessionsScheduled}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted-foreground)]">Next scheduled</dt>
          <dd className="mt-1 font-semibold">
            {entry.nextScheduledDayIndex === null
              ? 'No days left'
              : `Day ${entry.nextScheduledDayIndex}`}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

function BookTrackSection({
  entries,
  track,
}: {
  entries: readonly ChallengeBookProgress[];
  track: ChallengeBookTrack;
}) {
  const TrackIcon = TRACK_ICONS[track];
  const headingId = `challenge-books-${track}-heading`;
  const pagesRead = entries.reduce((total, entry) => total + entry.pagesRead, 0);
  const totalPages = entries.reduce((total, entry) => total + entry.book.pageCount, 0);

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrackIcon aria-hidden="true" className="size-5 text-[var(--muted-foreground)]" />
          <h2 className="text-lg font-bold" id={headingId}>
            {TRACK_LABELS[track]}
          </h2>
        </div>
        <Badge tone="neutral">
          {pagesRead} of {totalPages} pages
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {entries.map((entry) => (
          <BookProgressCard entry={entry} key={entry.book.id} />
        ))}
      </div>
    </section>
  );
}

export function ChallengeBooksPage() {
  const now = new Date();
  const challenge = useChallenge();
  const books = useChallengeBooks();
  const completions = useChallengeCompletions();

  const bookProgressList = selectBookProgressList(challenge, books, completions, now);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <section className="mb-6">
        <Badge tone="accent">{challenge.title}</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Reading list</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted-foreground)]">
          Every book on both rotations, and how far {challenge.readingPagesPerSession} pages a
          session has carried you through each one.
        </p>
      </section>

      <div className="mb-8">
        <ChallengeNav />
      </div>

      <div className="space-y-10">
        <BookTrackSection
          entries={selectBookProgressForTrack(bookProgressList, 'technical')}
          track="technical"
        />
        <BookTrackSection
          entries={selectBookProgressForTrack(bookProgressList, 'growth')}
          track="growth"
        />
      </div>
    </div>
  );
}
