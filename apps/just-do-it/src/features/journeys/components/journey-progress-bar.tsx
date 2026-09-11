import { cn } from '@just-do-it/ui';

type JourneyProgressBarProps = {
  label: string;
  value: number;
  className?: string;
  tone?: 'primary' | 'accent';
};

// Every journey route shows a percentage somewhere, and each one needs the same
// `progressbar` role for the value to be readable without relying on the bar's
// colour. Four consumers is what earned this its own component.
export function JourneyProgressBar({
  label,
  value,
  className,
  tone = 'primary',
}: JourneyProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={clampedValue}
      className={cn(
        'h-2 overflow-hidden rounded-full bg-[var(--surface-muted)] ring-1 ring-inset ring-[var(--border)]',
        className,
      )}
      role="progressbar"
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width]',
          tone === 'accent' ? 'bg-[var(--accent)]' : 'bg-[var(--primary)]',
        )}
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  );
}
