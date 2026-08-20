import { ArrowLeft, Flame, Percent, Trash2, Trophy } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Badge, Button, Card, Input, cn } from '@just-do-it/ui';
import {
  HabitDayGrid,
  isHabitCompletedOn,
  selectCompletionRate,
  selectCurrentStreak,
  selectLongestStreak,
  selectRecentCompletionDays,
  toHabitDateKey,
  useHabitById,
  useHabitCompletions,
  useRemoveHabit,
  useToggleHabitCompletion,
  useUpdateHabit,
  type HabitFrequency,
} from '../features/habits';

const controlClassName =
  'min-h-10 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]';

const linkButtonClassName =
  'inline-flex h-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2';

const HEATMAP_DAY_COUNT = 84;
const HEATMAP_WEEK_LENGTH = 7;

function normalizeOptionalDescription(value: string): string | undefined {
  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : undefined;
}

function clampWeeklyTarget(rawValue: string): number {
  const parsedValue = Number(rawValue) || 1;
  return Math.min(7, Math.max(1, parsedValue));
}

function chunkIntoWeeks(
  days: readonly { date: Date; complete: boolean }[],
): { date: Date; complete: boolean }[][] {
  const weeks: { date: Date; complete: boolean }[][] = [];

  for (let index = 0; index < days.length; index += HEATMAP_WEEK_LENGTH) {
    weeks.push(days.slice(index, index + HEATMAP_WEEK_LENGTH));
  }

  return weeks;
}

export function HabitDetailPage() {
  const { habitId = '' } = useParams();
  const navigate = useNavigate();
  const now = new Date();
  const habit = useHabitById(habitId);
  const completions = useHabitCompletions();
  const toggleHabitCompletion = useToggleHabitCompletion();
  const updateHabit = useUpdateHabit();
  const removeHabit = useRemoveHabit();

  const [draftLabel, setDraftLabel] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftFrequency, setDraftFrequency] = useState<HabitFrequency>('daily');
  const [draftTarget, setDraftTarget] = useState(1);

  useEffect(() => {
    if (!habit) return;

    setDraftLabel(habit.label);
    setDraftDescription(habit.description ?? '');
    setDraftFrequency(habit.frequency);
    setDraftTarget(habit.target);
  }, [habit]);

  if (!habit) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
        <Card>
          <h1 className="text-lg font-bold">Habit not found</h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            This habit is no longer being tracked.
          </p>
          <Link
            className="mt-4 inline-block text-sm font-semibold text-[var(--primary)]"
            to="/habits"
          >
            Back to habits
          </Link>
        </Card>
      </div>
    );
  }

  // Capture after the guard: hoisted function declarations below do not narrow
  // through `habit`, which is exactly the TS18047 bug the Lists work hit.
  const activeHabit = habit;
  const todayKey = toHabitDateKey(now);
  const currentStreak = selectCurrentStreak(activeHabit, completions, now);
  const longestStreak = selectLongestStreak(activeHabit, completions);
  const completionRate = selectCompletionRate(activeHabit, completions, now);
  const historyDays = selectRecentCompletionDays(
    completions,
    activeHabit.id,
    HEATMAP_DAY_COUNT,
    now,
  );
  const historyWeeks = chunkIntoWeeks(historyDays);
  const completedToday = isHabitCompletedOn(completions, activeHabit.id, todayKey);

  const normalizedLabel = draftLabel.trim();
  const normalizedDescription = normalizeOptionalDescription(draftDescription);
  const hasLabelChanged = normalizedLabel !== activeHabit.label;
  const hasDescriptionChanged = normalizedDescription !== activeHabit.description;
  const hasFrequencyChanged = draftFrequency !== activeHabit.frequency;
  const hasTargetChanged = draftTarget !== activeHabit.target;
  const hasChanges =
    hasLabelChanged || hasDescriptionChanged || hasFrequencyChanged || hasTargetChanged;

  function handleSaveChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!normalizedLabel || !hasChanges) return;

    updateHabit(activeHabit.id, {
      label: normalizedLabel,
      description: normalizedDescription,
      frequency: draftFrequency,
      target: draftFrequency === 'daily' ? 1 : draftTarget,
    });
  }

  function handleDeleteHabit() {
    removeHabit(activeHabit.id);
    navigate('/habits');
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <div className="mb-6">
        <Link className={cn(linkButtonClassName, 'gap-2')} to="/habits">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to habits
        </Link>
      </div>

      <section className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge tone="accent">Habit detail</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {activeHabit.label}
          </h1>
          <p className="mt-2 max-w-2xl text-[var(--muted-foreground)]">
            {activeHabit.description ?? 'No description yet. Add one from the edit form below.'}
          </p>
        </div>
        <Button
          aria-label={
            completedToday
              ? `Mark ${activeHabit.label} incomplete for today`
              : `Mark ${activeHabit.label} complete for today`
          }
          aria-pressed={completedToday}
          onClick={() => toggleHabitCompletion(activeHabit.id, todayKey)}
          variant={completedToday ? 'accent' : 'secondary'}
        >
          {completedToday ? 'Undo today' : 'Check in today'}
        </Button>
      </section>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <div className="flex items-center gap-3">
            <Flame aria-hidden="true" className="size-5 text-[var(--accent)]" />
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Current streak</p>
              <p className="mt-1 text-2xl font-bold">
                {currentStreak} {activeHabit.frequency === 'daily' ? 'day' : 'week'}
                {currentStreak === 1 ? '' : 's'}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <Trophy aria-hidden="true" className="size-5 text-[var(--primary)]" />
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Longest streak</p>
              <p className="mt-1 text-2xl font-bold">
                {longestStreak} {activeHabit.frequency === 'daily' ? 'day' : 'week'}
                {longestStreak === 1 ? '' : 's'}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <Percent aria-hidden="true" className="size-5 text-[var(--success)]" />
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Completion rate</p>
              <p className="mt-1 text-2xl font-bold">{Math.round(completionRate * 100)}%</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="space-y-6">
          <Card>
            <div className="mb-5">
              <h2 className="text-lg font-bold">Twelve-week history</h2>
              <p className="text-sm text-[var(--muted-foreground)]">
                A rolling 84-day view ending today. Rows are not aligned to calendar weeks.
              </p>
            </div>

            <div className="space-y-2">
              {historyWeeks.map((week) => (
                <HabitDayGrid
                  days={week}
                  highlightDateKey={todayKey}
                  key={toHabitDateKey(week[0].date)}
                  showWeekdayLabels={false}
                  size="small"
                />
              ))}
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <div className="mb-5">
              <Badge tone="neutral">Habit settings</Badge>
              <h2 className="mt-3 text-lg font-bold">Edit habit</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Update the label, description, frequency, or target for this habit.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSaveChanges}>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="habit-detail-label">
                  Name
                </label>
                <Input
                  id="habit-detail-label"
                  onChange={(event) => setDraftLabel(event.target.value)}
                  required
                  value={draftLabel}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="habit-detail-description">
                  Description
                </label>
                <textarea
                  className={controlClassName}
                  id="habit-detail-description"
                  onChange={(event) => setDraftDescription(event.target.value)}
                  placeholder="Add context for why this habit matters."
                  rows={3}
                  value={draftDescription}
                />
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium">Frequency</span>
                <div aria-label="Habit frequency" className="flex gap-2" role="group">
                  <Button
                    aria-pressed={draftFrequency === 'daily'}
                    onClick={() => setDraftFrequency('daily')}
                    type="button"
                    variant={draftFrequency === 'daily' ? 'primary' : 'secondary'}
                  >
                    Daily
                  </Button>
                  <Button
                    aria-pressed={draftFrequency === 'weekly'}
                    onClick={() => setDraftFrequency('weekly')}
                    type="button"
                    variant={draftFrequency === 'weekly' ? 'primary' : 'secondary'}
                  >
                    Weekly
                  </Button>
                </div>
              </div>

              {draftFrequency === 'weekly' ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="habit-detail-target">
                    Target per week
                  </label>
                  <Input
                    id="habit-detail-target"
                    max={7}
                    min={1}
                    onChange={(event) => setDraftTarget(clampWeeklyTarget(event.target.value))}
                    type="number"
                    value={draftTarget}
                  />
                </div>
              ) : null}

              <Button disabled={!normalizedLabel || !hasChanges} type="submit">
                Save changes
              </Button>
            </form>
          </Card>

          <Card variant="accent">
            <div className="mb-5">
              <Badge tone="neutral">Danger zone</Badge>
              <h2 className="mt-3 text-lg font-bold">Delete habit</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Removes this habit and its check-ins from the session store. This cannot be undone.
              </p>
            </div>
            <Button onClick={handleDeleteHabit} variant="secondary">
              <Trash2 aria-hidden="true" className="mr-2 size-4" />
              Delete habit
            </Button>
          </Card>
        </aside>
      </div>
    </div>
  );
}
