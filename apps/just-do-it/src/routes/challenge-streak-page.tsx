import { format, parseISO } from 'date-fns';
import { CheckCheck, Flame, ListChecks, Trophy } from 'lucide-react';

import { Badge, Card, cn } from '@just-do-it/ui';
import {
  ChallengeNav,
  ChallengeProgressBar,
  selectChallengeStats,
  selectDaySummaries,
  useChallenge,
  useChallengeBooks,
  useChallengeCompletions,
  type ChallengeActivityCategory,
  type ChallengeDayStatus,
  type ChallengeDaySummary,
} from '../features/challenge';

const CATEGORY_LABELS: Readonly<Record<ChallengeActivityCategory, string>> = {
  physical: 'Physical',
  technical_reading: 'Technical reading',
  growth_reading: 'Growth reading',
  reflection: 'Reflection',
};

const STATUS_LABELS: Readonly<Record<ChallengeDayStatus, string>> = {
  complete: 'Complete',
  partial: 'Partly done',
  in_progress: 'In progress',
  missed: 'Missed',
  upcoming: 'Upcoming',
};

// Green for a finished day, red for one that got away, purple for the day in
// hand — the palette's own semantics, so the map needs no extra tokens.
const STATUS_DOT_CLASSES: Readonly<Record<ChallengeDayStatus, string>> = {
  complete: 'border-[var(--primary)] bg-[var(--primary)]',
  partial: 'border-[var(--primary)] bg-[var(--primary-subtle)]',
  in_progress: 'border-[var(--accent)] bg-[var(--accent-subtle)]',
  missed: 'border-[var(--danger)] bg-[var(--danger-subtle)]',
  upcoming: 'border-[var(--border)] bg-[var(--surface-muted)]',
};

const LEGEND_ORDER: readonly ChallengeDayStatus[] = [
  'complete',
  'partial',
  'in_progress',
  'missed',
  'upcoming',
];

// Each dot carries its own label because the status is otherwise encoded only
// as a background colour. Spelling the status out matters most for the two that
// would read identically from their counts alone: a day that was missed and the
// day still being lived have both done nothing so far.
function describeDay(summary: ChallengeDaySummary): string {
  const date = format(parseISO(summary.date), 'd MMM yyyy');
  const detail: Readonly<Record<ChallengeDayStatus, string>> = {
    complete: 'complete',
    partial: `${summary.completedCount} of ${summary.activityCount} done`,
    in_progress: 'in progress, nothing done yet',
    missed: 'missed',
    upcoming: 'upcoming',
  };

  return `Day ${summary.dayIndex}, ${date} — ${detail[summary.status]}`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)]">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">{detail}</p>
      </div>
    </Card>
  );
}

export function ChallengeStreakPage() {
  const now = new Date();
  const challenge = useChallenge();
  const books = useChallengeBooks();
  const completions = useChallengeCompletions();

  const stats = selectChallengeStats(challenge, books, completions, now);
  const summaries = selectDaySummaries(challenge, books, completions, now);
  const activityPercent =
    stats.totalActivityCount === 0
      ? 0
      : Math.round((stats.completedActivityCount / stats.totalActivityCount) * 100);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <section className="mb-6">
        <Badge tone="accent">{challenge.title}</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Streak</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted-foreground)]">
          {stats.currentDayIndex === null
            ? `All ${challenge.totalDays} days, and how each one went.`
            : `Day ${stats.currentDayIndex} of ${challenge.totalDays}, with ${stats.remainingDayCount} still to go.`}
        </p>
      </section>

      <div className="mb-8">
        <ChallengeNav />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          detail="Days in a row fully finished"
          icon={Flame}
          label="Current streak"
          value={String(stats.currentStreak)}
        />
        <StatCard
          detail="Best run so far"
          icon={Trophy}
          label="Longest streak"
          value={String(stats.longestStreak)}
        />
        <StatCard
          detail={`Out of ${stats.elapsedDayCount} elapsed`}
          icon={CheckCheck}
          label="Days complete"
          value={String(stats.completedDayCount)}
        />
        <StatCard
          detail={`Of ${stats.totalActivityCount} across the challenge`}
          icon={ListChecks}
          label="Activities done"
          value={String(stats.completedActivityCount)}
        />
      </div>

      <Card className="mb-8 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">Overall progress</h2>
          <span className="text-sm font-semibold">{activityPercent}%</span>
        </div>
        <ChallengeProgressBar label="Overall challenge progress" value={activityPercent} />
        <p className="text-sm text-[var(--muted-foreground)]">
          {stats.completedActivityCount} of {stats.totalActivityCount} activities ticked off.
        </p>
      </Card>

      <section aria-labelledby="challenge-map-heading" className="space-y-4">
        <h2 className="text-lg font-bold" id="challenge-map-heading">
          Activity map
        </h2>

        <Card>
          {/* Ten columns of a hundred days, capped so the dots stay map-sized
              rather than growing to fill a wide card. Below that width the grid
              simply shrinks, which is what keeps it square on a phone. */}
          <ol className="grid max-w-80 grid-cols-10 gap-1.5">
            {summaries.map((summary) => (
              <li
                aria-label={describeDay(summary)}
                className={cn(
                  'aspect-square rounded-[4px] border sm:rounded-md',
                  STATUS_DOT_CLASSES[summary.status],
                  summary.isToday ? 'ring-2 ring-[var(--ring)] ring-offset-1' : '',
                )}
                key={summary.dayIndex}
              />
            ))}
          </ol>

          <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
            {LEGEND_ORDER.map((status) => (
              <li className="flex items-center gap-2 text-xs" key={status}>
                <span
                  aria-hidden="true"
                  className={cn('size-3 rounded-[3px] border', STATUS_DOT_CLASSES[status])}
                />
                <span className="text-[var(--muted-foreground)]">{STATUS_LABELS[status]}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section aria-labelledby="challenge-breakdown-heading" className="mt-8 space-y-4">
        <h2 className="text-lg font-bold" id="challenge-breakdown-heading">
          By activity
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {stats.categoryCounts.map((entry) => {
            const categoryPercent =
              entry.activityCount === 0
                ? 0
                : Math.round((entry.completedCount / entry.activityCount) * 100);

            return (
              <Card className="space-y-3" key={entry.category}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold">{CATEGORY_LABELS[entry.category]}</h3>
                  <span className="text-sm text-[var(--muted-foreground)]">
                    {entry.completedCount} of {entry.activityCount}
                  </span>
                </div>
                <ChallengeProgressBar
                  label={`${CATEGORY_LABELS[entry.category]} progress`}
                  value={categoryPercent}
                />
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
