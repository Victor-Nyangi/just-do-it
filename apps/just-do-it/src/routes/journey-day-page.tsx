import { format, parseISO } from 'date-fns';
import { BookOpen, Brain, Check, ChevronLeft, ChevronRight, Dumbbell, PenLine } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';

import { Badge, Button, Card, cn } from '@just-do-it/ui';
import {
  JourneyNav,
  JourneyNotFound,
  JourneyProgressBar,
  buildDayPlan,
  clampDayIndex,
  getCurrentDayIndex,
  selectActivitiesByCategory,
  selectCompletedActivityIdsForDay,
  selectCompletionsForEnrollment,
  selectDayProgress,
  useJourneyById,
  useJourneyCompletions,
  useJourneyEnrollment,
  useToggleJourneyActivity,
  type EnrolledJourney,
  type JourneyActivityCategory,
  type JourneyCompletion,
} from '../features/journeys';

const CATEGORY_LABELS: Readonly<Record<JourneyActivityCategory, string>> = {
  physical: 'Physical',
  technical_reading: 'Technical reading',
  growth_reading: 'Growth reading',
  reflection: 'Reflection',
};

const CATEGORY_ICONS = {
  physical: Dumbbell,
  technical_reading: BookOpen,
  growth_reading: Brain,
  reflection: PenLine,
} as const;

function formatJourneyDate(dateKey: string): string {
  return format(parseISO(dateKey), 'EEEE, d MMMM yyyy');
}

function JourneyDayView({
  completions,
  enrolled,
}: {
  completions: readonly JourneyCompletion[];
  enrolled: EnrolledJourney;
}) {
  const { enrollment, journey } = enrolled;
  const now = new Date();
  const toggleActivity = useToggleJourneyActivity();

  const currentDayIndex = getCurrentDayIndex(journey, enrollment, now);
  // Outside the window there is no current day, so the page opens on whichever
  // end of the journey the user is standing at rather than on nothing.
  const beforeJourneyStarts = parseISO(enrollment.startDate) > now;
  const openingDayIndex = currentDayIndex ?? (beforeJourneyStarts ? 1 : journey.totalDays);

  const [viewedDayIndex, setViewedDayIndex] = useState(openingDayIndex);
  const plan = buildDayPlan(journey, enrollment, viewedDayIndex);

  // `viewedDayIndex` only ever moves through `clampDayIndex`, so a missing plan
  // is not reachable — but the type says it can be, and an early return is
  // cheaper than asserting it away.
  if (!plan) return null;

  const progress = selectDayProgress(plan, completions);
  const completedIds = selectCompletedActivityIdsForDay(completions, plan.dayIndex);
  const progressPercent =
    progress.activityCount === 0
      ? 0
      : Math.round((progress.completedCount / progress.activityCount) * 100);
  const viewingToday = viewedDayIndex === currentDayIndex;

  function goToDay(dayIndex: number) {
    setViewedDayIndex(clampDayIndex(journey, dayIndex));
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
      <section className="mb-6">
        <Badge tone="accent">{journey.title}</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Day {plan.dayIndex} of {journey.totalDays}
        </h1>
        <p className="mt-2 text-[var(--muted-foreground)]">{formatJourneyDate(plan.date)}</p>
      </section>

      <div className="mb-6">
        <JourneyNav enrollmentId={enrollment.id} />
      </div>

      {currentDayIndex === null ? (
        <Card className="mb-6" variant="subtle">
          <p className="text-sm text-[var(--muted-foreground)]">
            {beforeJourneyStarts
              ? `This journey opens on ${formatJourneyDate(enrollment.startDate)}. This is the plan waiting for day one.`
              : `This journey closed on ${formatJourneyDate(plan.date)}. This is the record, not a checklist.`}
          </p>
        </Card>
      ) : null}

      <Card className="mb-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <Button
            aria-label="Go to the previous day"
            disabled={viewedDayIndex <= 1}
            onClick={() => goToDay(viewedDayIndex - 1)}
            variant="secondary"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Button>

          <div className="text-center">
            <p className="text-sm font-semibold">
              {progress.completedCount} of {progress.activityCount} done
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {viewingToday ? 'Today' : `Day ${plan.dayIndex}`}
            </p>
          </div>

          <Button
            aria-label="Go to the next day"
            disabled={viewedDayIndex >= journey.totalDays}
            onClick={() => goToDay(viewedDayIndex + 1)}
            variant="secondary"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        </div>

        <JourneyProgressBar
          label={`Day ${plan.dayIndex} progress`}
          tone={progress.complete ? 'primary' : 'accent'}
          value={progressPercent}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          {progress.complete ? (
            <Badge tone="success">Day complete</Badge>
          ) : (
            <Badge tone="neutral">{progressPercent}% complete</Badge>
          )}

          {currentDayIndex !== null && !viewingToday ? (
            <Button onClick={() => goToDay(currentDayIndex)} variant="ghost">
              Back to today
            </Button>
          ) : null}
        </div>
      </Card>

      <section aria-labelledby="journey-checklist-heading" className="space-y-6">
        <h2 className="text-lg font-bold" id="journey-checklist-heading">
          Today&rsquo;s plan
        </h2>

        {selectActivitiesByCategory(plan).map(({ category, activities }) => {
          const CategoryIcon = CATEGORY_ICONS[category];

          return (
            <div className="space-y-3" key={category}>
              <div className="flex items-center gap-2">
                <CategoryIcon
                  aria-hidden="true"
                  className="size-4 text-[var(--muted-foreground)]"
                />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  {CATEGORY_LABELS[category]}
                </h3>
              </div>

              <ul className="space-y-3">
                {activities.map((activity) => {
                  const completed = completedIds.has(activity.id);

                  return (
                    <li key={activity.id}>
                      <button
                        aria-label={
                          completed
                            ? `Mark ${activity.label} incomplete for day ${plan.dayIndex}`
                            : `Mark ${activity.label} complete for day ${plan.dayIndex}`
                        }
                        aria-pressed={completed}
                        className={cn(
                          'flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2',
                          completed
                            ? 'border-[var(--primary)] bg-[var(--primary-subtle)]'
                            : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)]',
                        )}
                        onClick={() => toggleActivity(enrollment.id, plan.dayIndex, activity.id)}
                        type="button"
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'flex size-6 shrink-0 items-center justify-center rounded-full border',
                            completed
                              ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                              : 'border-[var(--border)] bg-[var(--surface)]',
                          )}
                        >
                          {completed ? <Check className="size-4" /> : null}
                        </span>

                        <span className="min-w-0">
                          <span
                            className={cn(
                              'block font-semibold',
                              completed ? 'text-[var(--primary)]' : '',
                            )}
                          >
                            {activity.label}
                          </span>
                          <span className="mt-0.5 block text-sm text-[var(--muted-foreground)]">
                            {activity.detail}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>
    </div>
  );
}

export function JourneyDayPage() {
  const { enrollmentId = '' } = useParams<{ enrollmentId: string }>();
  const enrollment = useJourneyEnrollment(enrollmentId);
  const journey = useJourneyById(enrollment?.journeyId ?? '');
  const allCompletions = useJourneyCompletions();

  if (!enrollment || !journey) return <JourneyNotFound />;

  return (
    <JourneyDayView
      completions={selectCompletionsForEnrollment(allCompletions, enrollment.id)}
      enrolled={{ enrollment, journey }}
      // Switching enrollment must reset which day is being viewed, and that
      // day lives in `useState` inside the view.
      key={enrollment.id}
    />
  );
}
