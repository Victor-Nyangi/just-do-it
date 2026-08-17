import type { HTMLAttributes } from 'react';

import { cn } from '../lib/cn';

type CardVariant = 'default' | 'elevated' | 'accent' | 'subtle';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
};

const variants: Record<CardVariant, string> = {
  default: 'bg-[var(--surface)] shadow-[var(--card-shadow)]',
  elevated: 'bg-[var(--surface)] shadow-[var(--card-shadow)] ring-1 ring-black/5',
  accent: 'bg-gradient-to-br from-[var(--accent-subtle)] to-[var(--surface)]',
  subtle: 'bg-[var(--surface-muted)] shadow-none',
};

export function Card({ className, variant = 'default', ...props }: CardProps) {
  return (
    <div
      className={cn('rounded-xl border border-[var(--border)] p-5', variants[variant], className)}
      {...props}
    />
  );
}
