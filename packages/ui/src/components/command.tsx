import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

import { cn } from '../lib/cn';

export type CommandOption = {
  id: string;
  group: string;
  label: string;
  hint?: string;
};

export type CommandProps = {
  ariaLabel: string;
  emptyLabel: string;
  footer?: ReactNode;
  onDismiss: () => void;
  onQueryChange: (query: string) => void;
  onSelect: (optionId: string) => void;
  options: readonly CommandOption[];
  placeholder: string;
  query: string;
};

// Presentational only: it renders the options it is handed, in the order it is
// handed them, and reports what the user did. Filtering, routing and any idea
// of what a command means all live in the consumer.
export function Command({
  ariaLabel,
  emptyLabel,
  footer,
  onDismiss,
  onQueryChange,
  onSelect,
  options,
  placeholder,
  query,
}: CommandProps) {
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // The option list changes as the user types, so an index held from a previous
  // list can point past the end of the new one.
  useEffect(() => {
    setActiveIndex(0);
  }, [options]);

  // Focus moves in on open and must go back where it came from on unmount, or
  // closing the palette strands focus on `document.body` and the next Tab
  // starts from the top of the page.
  useEffect(() => {
    const previouslyFocused = document.activeElement;

    inputRef.current?.focus();

    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  const groups = useMemo(() => {
    const grouped = new Map<string, CommandOption[]>();

    for (const option of options) {
      const existing = grouped.get(option.group);

      if (existing) {
        existing.push(option);
      } else {
        grouped.set(option.group, [option]);
      }
    }

    return [...grouped.entries()];
  }, [options]);

  const activeOption = options[activeIndex];

  function moveActiveIndex(offset: number) {
    if (options.length === 0) return;

    setActiveIndex((current) => {
      const nextIndex = (current + offset + options.length) % options.length;
      return nextIndex;
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActiveIndex(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActiveIndex(-1);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (activeOption) onSelect(activeOption.id);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      onDismiss();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--overlay)] p-4 pt-24">
      <div
        aria-label={ariaLabel}
        aria-modal="true"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        role="dialog"
      >
        <input
          aria-activedescendant={activeOption ? `${baseId}-${activeOption.id}` : undefined}
          aria-controls={listboxId}
          aria-expanded="true"
          aria-label={ariaLabel}
          autoComplete="off"
          className="w-full border-b border-[var(--border)] bg-transparent px-4 py-3 text-sm outline-none placeholder:text-[var(--muted-foreground)]"
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          ref={inputRef}
          role="combobox"
          value={query}
        />

        {/* Deliberately divs rather than ul/li: a `role="listbox"` may only
            contain options and groups, and `<li>` carries an implicit
            listitem role that would make the structure invalid. */}
        <div className="max-h-80 overflow-y-auto p-2" id={listboxId} role="listbox">
          {options.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[var(--muted-foreground)]">
              {emptyLabel}
            </p>
          ) : (
            groups.map(([group, groupOptions]) => (
              <div aria-label={group} key={group} role="group">
                <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  {group}
                </p>
                {groupOptions.map((option) => {
                  const isActive = option.id === activeOption?.id;

                  return (
                    <div
                      aria-selected={isActive}
                      className={cn(
                        'flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm',
                        isActive
                          ? 'bg-[var(--primary-subtle)] text-[var(--primary)]'
                          : 'text-[var(--foreground)]',
                      )}
                      id={`${baseId}-${option.id}`}
                      key={option.id}
                      onClick={() => onSelect(option.id)}
                      role="option"
                    >
                      <span>{option.label}</span>
                      {option.hint ? (
                        <kbd className="rounded border border-[var(--border)] px-1.5 py-0.5 text-xs text-[var(--muted-foreground)]">
                          {option.hint}
                        </kbd>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {footer ? (
          <div className="border-t border-[var(--border)] px-4 py-3 text-sm">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
