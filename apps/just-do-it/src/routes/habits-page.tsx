import { Flame, ListChecks, Plus, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { Badge, Button, Card, Input } from '@just-do-it/ui';
import {
  HabitDayGrid,
  isHabitCompletedOn,
  selectCurrentStreak,
  selectRecentCompletionDays,
  toHabitDateKey,
  useAddHabit,
  useHabitCompletions,
  useHabits,
  useToggleHabitCompletion,
  type Habit,
  type HabitFrequency,
} from '../features/habits';

const linkButtonClassName =
  'inline-flex h-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2';

function formatHabitFrequencyLabel(habit: Habit): string {
  return habit.frequency === 'daily' ? 'Daily' : `${habit.target}× per week`;
}

function clampWeeklyTarget(rawValue: string): number {
  const parsedValue = Number(rawValue) || 1;
  return Math.min(7, Math.max(1, parsedValue));
}

function HabitsEmptyState({ onCreateHabit }: { onCreateHabit: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--muted-foreground)]">
        <Flame aria-hidden="true" className="size-6" />
      </div>
      <h2 className="mt-4 text-lg font-bold">No habits yet</h2>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        Add a daily or weekly habit to start building a streak in the current session.
      </p>
      <Button className="mt-4" onClick={onCreateHabit}>
        <Plus aria-hidden="true" className="mr-2 size-4" />
        Add habit
      </Button>
    </div>
  );
}

export function HabitsPage() {
  const now = new Date();
  const habits = useHabits();
  const completions = useHabitCompletions();
  const toggleHabitCompletion = useToggleHabitCompletion();
  const addHabit = useAddHabit();
  const todayKey = toHabitDateKey(now);

  const [newHabitLabel, setNewHabitLabel] = useState('');
  const [newHabitFrequency, setNewHabitFrequency] = useState<HabitFrequency>('daily');
  const [newHabitTarget, setNewHabitTarget] = useState(3);

  const checkedTodayCount = habits.filter((habit) =>
    isHabitCompletedOn(completions, habit.id, todayKey),
  ).length;
  const bestCurrentStreak = habits.reduce(
    (best, habit) => Math.max(best, selectCurrentStreak(habit, completions, now)),
    0,
  );

  function createHabit() {
    const label = newHabitLabel.trim();
    if (!label) return;

    addHabit({
      label,
      frequency: newHabitFrequency,
      target: newHabitTarget,
    });

    setNewHabitLabel('');
  }

  function focusComposer() {
    document.getElementById('habit-label')?.focus();
  }

  function handleCreateHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createHabit();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <section className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <Badge tone="accent">Habit tracking</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Habits</h1>
          <p className="mt-2 max-w-2xl text-[var(--muted-foreground)]">
            Track daily and weekly habits, check in for today, and watch streaks build across the
            session.
          </p>
        </div>
        <Button onClick={focusComposer}>
          <Sparkles aria-hidden="true" className="mr-2 size-4" />
          New habit
        </Button>
      </section>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-[var(--muted-foreground)]">Habits tracked</p>
          <p className="mt-3 text-2xl font-bold">{habits.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-[var(--muted-foreground)]">Checked in today</p>
          <p className="mt-3 text-2xl font-bold">
            {checkedTodayCount}/{habits.length}
          </p>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <Flame aria-hidden="true" className="size-5 text-[var(--accent)]" />
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Best current streak</p>
              <p className="mt-1 text-2xl font-bold">{bestCurrentStreak}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <section aria-labelledby="all-habits-heading" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold" id="all-habits-heading">
                Your habits
              </h2>
              <p className="text-sm text-[var(--muted-foreground)]">
                Open any habit for its full history and edit options.
              </p>
            </div>
            {habits.length > 0 ? (
              <Badge tone="neutral">
                {habits.length} habit{habits.length === 1 ? '' : 's'}
              </Badge>
            ) : null}
          </div>

          {habits.length === 0 ? (
            <HabitsEmptyState onCreateHabit={focusComposer} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {habits.map((habit) => {
                const completedToday = isHabitCompletedOn(completions, habit.id, todayKey);
                const currentStreak = selectCurrentStreak(habit, completions, now);
                const recentDays = selectRecentCompletionDays(completions, habit.id, 7, now);

                return (
                  <article key={habit.id}>
                    <Card className="flex h-full flex-col gap-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link
                            className="text-lg font-bold hover:text-[var(--primary)]"
                            to={`/habits/${habit.id}`}
                          >
                            {habit.label}
                          </Link>
                          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                            {currentStreak > 0
                              ? `${currentStreak} ${habit.frequency === 'daily' ? 'day' : 'week'}${currentStreak === 1 ? '' : 's'} running`
                              : 'No streak yet'}
                          </p>
                        </div>
                        <Badge tone="neutral">{formatHabitFrequencyLabel(habit)}</Badge>
                      </div>

                      <HabitDayGrid days={recentDays} highlightDateKey={todayKey} />

                      <div className="mt-auto flex items-center justify-between gap-3">
                        <Link className={linkButtonClassName} to={`/habits/${habit.id}`}>
                          View history
                        </Link>
                        <Button
                          aria-label={
                            completedToday
                              ? `Mark ${habit.label} incomplete for today`
                              : `Mark ${habit.label} complete for today`
                          }
                          aria-pressed={completedToday}
                          onClick={() => toggleHabitCompletion(habit.id, todayKey)}
                          variant={completedToday ? 'accent' : 'secondary'}
                        >
                          {completedToday ? 'Undo today' : 'Check in'}
                        </Button>
                      </div>
                    </Card>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <Card>
            <div className="mb-5">
              <Badge tone="neutral">Session-local composer</Badge>
              <h2 className="mt-3 text-lg font-bold">Add a habit</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                New habits join the shared session store and appear on Today and the calendar too.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleCreateHabit}>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="habit-label">
                  Habit name
                </label>
                <Input
                  id="habit-label"
                  onChange={(event) => setNewHabitLabel(event.target.value)}
                  placeholder="Drink water"
                  required
                  value={newHabitLabel}
                />
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium">Frequency</span>
                <div className="flex gap-2" role="group" aria-label="Habit frequency">
                  <Button
                    aria-pressed={newHabitFrequency === 'daily'}
                    onClick={() => setNewHabitFrequency('daily')}
                    type="button"
                    variant={newHabitFrequency === 'daily' ? 'primary' : 'secondary'}
                  >
                    Daily
                  </Button>
                  <Button
                    aria-pressed={newHabitFrequency === 'weekly'}
                    onClick={() => setNewHabitFrequency('weekly')}
                    type="button"
                    variant={newHabitFrequency === 'weekly' ? 'primary' : 'secondary'}
                  >
                    Weekly
                  </Button>
                </div>
              </div>

              {newHabitFrequency === 'weekly' ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="habit-target">
                    Target per week
                  </label>
                  <Input
                    id="habit-target"
                    max={7}
                    min={1}
                    onChange={(event) => setNewHabitTarget(clampWeeklyTarget(event.target.value))}
                    type="number"
                    value={newHabitTarget}
                  />
                </div>
              ) : null}

              <Button className="w-full sm:w-auto" type="submit">
                <Plus aria-hidden="true" className="mr-2 size-4" />
                Add habit
              </Button>
            </form>
          </Card>

          <Card variant="accent">
            <h2 className="text-lg font-bold">How it works</h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--muted-foreground)]">
              <li>
                <ListChecks aria-hidden="true" className="mr-1 inline size-3.5" />
                Check in daily habits every day, weekly habits up to their target.
              </li>
              <li>• Open a habit for its full streak history and edit options.</li>
              <li>• Check-ins stay in sync with Today and the calendar.</li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
