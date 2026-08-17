import type { HTMLAttributes } from 'react';

import { cn } from '../lib/cn';

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-[var(--surface-muted)] text-[var(--muted-foreground)]',
  accent: 'bg-[var(--accent-subtle)] text-[var(--accent)]',
  success: 'bg-[var(--success-subtle)] text-[var(--success)]',
  warning: 'bg-[var(--warning-subtle)] text-[var(--warning)]',
};

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
