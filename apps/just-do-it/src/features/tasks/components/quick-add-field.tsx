import { format, parseISO } from 'date-fns';
import { CalendarClock, Flag, Plus, Tag } from 'lucide-react';
import { useState } from 'react';

import { Button, Input, cn } from '@just-do-it/ui';
import { defaultTaskEditorValues, toTaskInput } from '../task-data';
import { useCreateTask } from '../hooks';
import { parseQuickAdd } from '../quick-add-parser';

const chipClassName =
  'inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium';

export function QuickAddField() {
  const createTask = useCreateTask();
  const [draft, setDraft] = useState('');

  const parsed = parseQuickAdd(draft);
  const hasTitle = parsed.title.length > 0;

  function submit() {
    if (!hasTitle) return;

    createTask(
      toTaskInput({
        ...defaultTaskEditorValues,
        title: parsed.title,
        dueDate: parsed.dueDate ?? '',
        category: parsed.category ?? defaultTaskEditorValues.category,
        priority: parsed.priority ?? defaultTaskEditorValues.priority,
      }),
    );

    setDraft('');
  }

  return (
    <div>
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label className="sr-only" htmlFor="quick-add-field">
          Quick add task
        </label>
        <Input
          aria-describedby="quick-add-field-preview"
          className="flex-1"
          id="quick-add-field"
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Read 20 pages Friday #Reading !high"
          value={draft}
        />
        <Button aria-label="Add task" disabled={!hasTitle} type="submit">
          <Plus aria-hidden="true" className="mr-2 size-4" />
          Add task
        </Button>
      </form>

      <div aria-live="polite" className="mt-3 text-sm" id="quick-add-field-preview">
        {draft.trim().length === 0 ? (
          <p className="text-[var(--muted-foreground)]">
            Add a day, <code>#category</code> or <code>!priority</code> and they will be read out of
            the text.
          </p>
        ) : hasTitle ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{parsed.title}</span>
            <span
              className={cn(
                chipClassName,
                parsed.dueDate
                  ? 'border-[var(--warning)] text-[var(--warning)]'
                  : 'text-[var(--muted-foreground)]',
              )}
            >
              <CalendarClock aria-hidden="true" className="size-3" />
              {parsed.dueDate ? format(parseISO(parsed.dueDate), 'EEE d MMM') : 'No date'}
            </span>
            <span
              className={cn(chipClassName, !parsed.category && 'text-[var(--muted-foreground)]')}
            >
              <Tag aria-hidden="true" className="size-3" />
              {parsed.category ?? defaultTaskEditorValues.category}
            </span>
            <span
              className={cn(chipClassName, !parsed.priority && 'text-[var(--muted-foreground)]')}
            >
              <Flag aria-hidden="true" className="size-3" />
              {parsed.priority ?? defaultTaskEditorValues.priority}
            </span>
          </div>
        ) : (
          <p className="text-[var(--muted-foreground)]">
            Add a title — that is everything outside the date and the sigils.
          </p>
        )}
      </div>
    </div>
  );
}
