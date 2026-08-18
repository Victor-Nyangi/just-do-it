import { format } from 'date-fns';

import { cn } from '@just-do-it/ui';
import { toHabitDateKey } from '../habit-selectors';

type HabitDayGridProps = {
  days: readonly { date: Date; complete: boolean }[];
  highlightDateKey?: string;
  showWeekdayLabels?: boolean;
  size?: 'small' | 'medium';
};

export function HabitDayGrid({
  days,
  highlightDateKey,
  showWeekdayLabels = true,
  size = 'medium',
}: HabitDayGridProps) {
  return (
    <div aria-hidden="true" className="flex items-center gap-2">
      {days.map((day) => {
        const dateKey = toHabitDateKey(day.date);

        return (
          <div className="flex flex-col items-center gap-1" key={dateKey}>
            {showWeekdayLabels ? (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                {format(day.date, 'EEEEE')}
              </span>
            ) : null}
            <span
              className={cn(
                'rounded-full border',
                size === 'small' ? 'size-4' : 'size-7',
                day.complete
                  ? 'border-[var(--primary)] bg-[var(--primary)]'
                  : 'border-[var(--border)] bg-[var(--surface)]',
                dateKey === highlightDateKey
                  ? 'ring-2 ring-[var(--ring)] ring-offset-2 ring-offset-[var(--surface-muted)]'
                  : '',
              )}
            />
          </div>
        );
      })}
    </div>
  );
}
