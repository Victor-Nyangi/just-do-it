import { format, isValid, parseISO } from 'date-fns';
import { RotateCcw } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';

import { Button, Input, cn } from '@just-do-it/ui';
import { journeyEnrollmentSchema, toJourneyDateKey } from '../journey-data';

type StartChoice = 'today' | 'date';

export type RestartJourneyDialogProps = {
  journeyTitle: string;
  // How many activities are ticked on the run being replaced — what the
  // restart throws away, and so what the person has to be told about.
  completedCount: number;
  // Written by the caller, who knows what went wrong; the dialog only shows it.
  error: string | null;
  onCancel: () => void;
  // Resolves once the restart has settled either way. The caller closes the
  // dialog on success and hands back an `error` otherwise.
  onRestart: (startDate: string) => Promise<void>;
};

// The same rule the start-date field on the journeys page is held to, because
// it is the enrollment schema that refuses anything else: a real calendar day
// in YYYY-MM-DD form. Past days are allowed, exactly as they are there.
function isStartDate(value: string): boolean {
  return (
    journeyEnrollmentSchema.shape.startDate.safeParse(value).success && isValid(parseISO(value))
  );
}

function describeConsequence(completedCount: number, startDate: string): string {
  const dayOne = format(parseISO(startDate), 'd MMM yyyy');

  if (completedCount === 0) return `Day 1 will be ${dayOne}.`;

  const noun = completedCount === 1 ? 'activity' : 'activities';

  return `This clears the ${completedCount} ${noun} you've ticked on this run and starts day 1 on ${dayOne}. It can't be undone.`;
}

// Everything Tab can land on inside the dialog. An unchecked radio is skipped
// because the browser treats a radio group as a single tab stop on its checked
// option, and the trap below has to agree with it about where the ends are.
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]):not([type="radio"]), input[type="radio"]:checked:not([disabled])';

// Presentational: it knows nothing about sync or routing. The route supplies
// what a restart means and what happens after it.
export function RestartJourneyDialog({
  completedCount,
  error,
  journeyTitle,
  onCancel,
  onRestart,
}: RestartJourneyDialogProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const consequenceId = `${baseId}-consequence`;
  const dateFieldId = `${baseId}-date`;

  const [today] = useState(() => toJourneyDateKey(new Date()));
  const [choice, setChoice] = useState<StartChoice>('today');
  const [chosenDate, setChosenDate] = useState(today);
  const [pending, setPending] = useState(false);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const todayRadioRef = useRef<HTMLInputElement | null>(null);

  const startDate = choice === 'today' ? today : chosenDate;
  const startDateIsValid = isStartDate(startDate);
  const canRestart = startDateIsValid && !pending;

  // Focus moves in on open and goes back where it came from on close, as the
  // command palette does. The element it came from may be gone by then — the
  // card of a run that was just replaced — in which case there is nowhere
  // sensible to return to.
  useEffect(() => {
    const previouslyFocused = document.activeElement;

    todayRadioRef.current?.focus();

    return () => {
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, []);

  function dismiss() {
    if (!pending) onCancel();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      dismiss();
      return;
    }

    if (event.key !== 'Tab' || !dialogRef.current) return;

    // Keep Tab inside the dialog: it is modal, and focus wandering onto the
    // page behind it would be focus on things that cannot be used.
    const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) dismiss();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canRestart) return;

    setPending(true);

    try {
      await onRestart(startDate);
    } catch {
      // The caller owns reporting: it hands back `error`. Swallowed here only so
      // that a throw cannot leave the dialog stuck in flight.
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        aria-describedby={consequenceId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl sm:p-6"
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <h2 className="text-lg font-bold" id={titleId}>
          Restart {journeyTitle}?
        </h2>

        <form className="mt-4 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">When should day 1 be?</legend>

            <label
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm',
                choice === 'today'
                  ? 'border-[var(--primary)] bg-[var(--primary-subtle)]'
                  : 'border-[var(--border)]',
              )}
            >
              <input
                checked={choice === 'today'}
                className="size-4 accent-[var(--primary)]"
                disabled={pending}
                name={`${baseId}-start`}
                onChange={() => setChoice('today')}
                ref={todayRadioRef}
                type="radio"
                value="today"
              />
              <span className="font-semibold">Start today</span>
            </label>

            <div
              className={cn(
                'rounded-lg border p-3 text-sm',
                choice === 'date'
                  ? 'border-[var(--primary)] bg-[var(--primary-subtle)]'
                  : 'border-[var(--border)]',
              )}
            >
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  checked={choice === 'date'}
                  className="size-4 accent-[var(--primary)]"
                  disabled={pending}
                  name={`${baseId}-start`}
                  onChange={() => setChoice('date')}
                  type="radio"
                  value="date"
                />
                <span className="font-semibold">Start on a date</span>
              </label>
              <div className="mt-3 flex flex-wrap items-center gap-2 pl-7">
                <label className="text-[var(--muted-foreground)]" htmlFor={dateFieldId}>
                  Start date
                </label>
                <Input
                  aria-invalid={choice === 'date' && !startDateIsValid}
                  className="border-[var(--border)] bg-[var(--surface)] disabled:opacity-50"
                  disabled={choice !== 'date' || pending}
                  id={dateFieldId}
                  onChange={(event) => setChosenDate(event.target.value)}
                  type="date"
                  value={chosenDate}
                />
              </div>
            </div>
          </fieldset>

          <p
            className="rounded-lg bg-[var(--surface-muted)] p-3 text-sm text-[var(--muted-foreground)]"
            id={consequenceId}
          >
            {startDateIsValid
              ? describeConsequence(completedCount, startDate)
              : 'Pick a start date.'}
          </p>

          {error ? (
            <p
              className="rounded-lg bg-[var(--danger-subtle)] p-3 text-sm text-[var(--danger)]"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button disabled={pending} onClick={dismiss} variant="secondary">
              Cancel
            </Button>
            <Button disabled={!canRestart} type="submit">
              <RotateCcw aria-hidden="true" className="mr-2 size-4" />
              {pending ? 'Restarting…' : 'Restart'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
