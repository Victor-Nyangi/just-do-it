import { format, parseISO } from 'date-fns';
import { Compass, Play, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { Badge, Button, Card, Input } from '@just-do-it/ui';
import {
  JourneyProgressBar,
  getCurrentDayIndex,
  getEndDateKey,
  selectCompletionsForEnrollment,
  selectEnrolledJourneys,
  selectJourneyStats,
  toJourneyDateKey,
  useCreateJourney,
  useJourneyCompletions,
  useJourneyEnrollments,
  useJourneys,
  type EnrolledJourney,
  type Journey,
  type JourneyCompletion,
} from '../features/journeys';
import { useSyncedEnrollInJourney, useSyncedLeaveJourney } from '../features/sync';

function formatJourneyDate(dateKey: string): string {
  return format(parseISO(dateKey), 'd MMM yyyy');
}

function describeJourneyShape(journey: Journey): string {
  const parts: string[] = [`${journey.totalDays} days`];

  if (journey.physicalActivities.length > 0) {
    parts.push(`${journey.physicalActivities.length} movements`);
  }

  if (journey.books.length > 0) {
    parts.push(`${journey.books.length} books`);
  }

  if (journey.reflectionLineCount > 0) {
    parts.push(`${journey.reflectionLineCount}-line reflection`);
  }

  return parts.join(' · ');
}

function EnrolledJourneyCard({
  completions,
  enrolled,
  onLeave,
}: {
  completions: readonly JourneyCompletion[];
  enrolled: EnrolledJourney;
  onLeave: () => void;
}) {
  const { enrollment, journey } = enrolled;
  const now = new Date();
  const stats = selectJourneyStats(enrolled, completions, now);
  const currentDayIndex = getCurrentDayIndex(journey, enrollment, now);
  const activityPercent =
    stats.totalActivityCount === 0
      ? 0
      : Math.round((stats.completedActivityCount / stats.totalActivityCount) * 100);

  return (
    <Card className="flex h-full flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            className="text-lg font-bold hover:text-[var(--primary)]"
            to={`/journeys/${enrollment.id}`}
          >
            {journey.title}
          </Link>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {formatJourneyDate(enrollment.startDate)} &ndash;{' '}
            {formatJourneyDate(getEndDateKey(journey, enrollment))}
          </p>
        </div>
        {currentDayIndex === null ? (
          <Badge tone="neutral">Not running</Badge>
        ) : (
          <Badge tone="accent">
            Day {currentDayIndex}/{journey.totalDays}
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-[var(--muted-foreground)]">{stats.currentStreak} day streak</span>
          <span className="font-semibold">{activityPercent}%</span>
        </div>
        <JourneyProgressBar label={`${journey.title} progress`} value={activityPercent} />
      </div>

      <div className="mt-auto flex items-center justify-between gap-3">
        <Link
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary-hover)]"
          to={`/journeys/${enrollment.id}`}
        >
          Open
        </Link>
        <Button aria-label={`Leave ${journey.title}`} onClick={onLeave} variant="ghost">
          <Trash2 aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </Card>
  );
}

export function JourneysPage() {
  const journeys = useJourneys();
  const enrollments = useJourneyEnrollments();
  const completions = useJourneyCompletions();
  const enrollInJourney = useSyncedEnrollInJourney();
  const leaveJourney = useSyncedLeaveJourney();
  const createJourney = useCreateJourney();

  const [startDate, setStartDate] = useState(() => toJourneyDateKey(new Date()));
  const [newJourneyTitle, setNewJourneyTitle] = useState('');
  const [newJourneyDays, setNewJourneyDays] = useState(30);

  const enrolledJourneys = selectEnrolledJourneys(journeys, enrollments);
  const enrolledJourneyIds = new Set(enrolledJourneys.map((entry) => entry.journey.id));
  const availableJourneys = journeys.filter((journey) => !enrolledJourneyIds.has(journey.id));

  function handleCreateJourney(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = newJourneyTitle.trim();
    if (!title) return;

    // A journey with no physical work and no books still needs to schedule
    // something, so a new one starts as a reflection-only skeleton. The rest is
    // filled in by the editor, which does not exist yet.
    createJourney({
      title,
      description: 'A custom journey. Add reading and physical work to it.',
      totalDays: newJourneyDays,
      reflectionLineCount: 3,
    });

    setNewJourneyTitle('');
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <section className="mb-8">
        <Badge tone="accent">Journeys</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Your journeys</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted-foreground)]">
          A journey is a plan for a run of days. Start one on any date &mdash; the dates belong to
          your enrollment, so the same journey can be run again later without losing this one.
        </p>
      </section>

      <section aria-labelledby="running-journeys-heading" className="mb-10 space-y-4">
        <h2 className="text-lg font-bold" id="running-journeys-heading">
          Running
        </h2>

        {enrolledJourneys.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--muted-foreground)]">
              <Compass aria-hidden="true" className="size-6" />
            </div>
            <p className="mt-4 text-sm text-[var(--muted-foreground)]">
              Nothing running yet. Start one below.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {enrolledJourneys.map((enrolled) => (
              <EnrolledJourneyCard
                completions={selectCompletionsForEnrollment(completions, enrolled.enrollment.id)}
                enrolled={enrolled}
                key={enrolled.enrollment.id}
                onLeave={() => leaveJourney(enrolled.enrollment.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="available-journeys-heading" className="mb-10 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-bold" id="available-journeys-heading">
            Available
          </h2>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium" htmlFor="journey-start-date">
              Start on
            </label>
            <Input
              className="border-[var(--border)]"
              id="journey-start-date"
              onChange={(event) => setStartDate(event.target.value)}
              type="date"
              value={startDate}
            />
          </div>
        </div>

        {availableJourneys.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            Every journey is already running.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {availableJourneys.map((journey) => (
              <Card className="flex h-full flex-col gap-4" key={journey.id}>
                <div>
                  <h3 className="font-bold">{journey.title}</h3>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    {journey.description}
                  </p>
                </div>
                <Badge tone="neutral">{describeJourneyShape(journey)}</Badge>
                <div className="mt-auto">
                  <Button
                    aria-label={`Start ${journey.title}`}
                    onClick={() => void enrollInJourney(journey.id, startDate)}
                  >
                    <Play aria-hidden="true" className="mr-2 size-4" />
                    Start
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="new-journey-heading">
        <Card variant="accent">
          <h2 className="text-lg font-bold" id="new-journey-heading">
            New journey
          </h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Creates a reflection-only skeleton you can start straight away. Editing its rotation and
            reading list is not built yet.
          </p>

          <form
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={handleCreateJourney}
          >
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium" htmlFor="new-journey-title">
                Title
              </label>
              <Input
                className="w-full border-[var(--border)]"
                id="new-journey-title"
                onChange={(event) => setNewJourneyTitle(event.target.value)}
                placeholder="100 Days to Dex"
                required
                value={newJourneyTitle}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="new-journey-days">
                Days
              </label>
              <Input
                className="border-[var(--border)]"
                id="new-journey-days"
                max={1000}
                min={1}
                onChange={(event) =>
                  setNewJourneyDays(Math.min(1000, Math.max(1, Number(event.target.value) || 1)))
                }
                type="number"
                value={newJourneyDays}
              />
            </div>
            <Button type="submit">
              <Plus aria-hidden="true" className="mr-2 size-4" />
              Create
            </Button>
          </form>
        </Card>
      </section>
    </div>
  );
}
