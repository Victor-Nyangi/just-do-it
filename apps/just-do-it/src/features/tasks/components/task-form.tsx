import { useState, type FormEvent } from 'react';

import { Button, Input } from '@just-do-it/ui';
import {
  TASK_CATEGORY_VALUES,
  TASK_PRIORITY_VALUES,
  TASK_RECURRENCE_VALUES,
  TASK_STATUS_VALUES,
  type TaskEditorValues,
} from '../types';

type TaskFormProps = {
  initialValues: TaskEditorValues;
  mode: 'create' | 'edit';
  onCancel?: () => void;
  onSubmit: (values: TaskEditorValues) => void;
};

const controlClassName =
  'min-h-10 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]';

function formatOptionLabel(value: string): string {
  return value.replace(/_/gu, ' ').replace(/\b\w/gu, (character) => character.toUpperCase());
}

export function TaskForm({ initialValues, mode, onCancel, onSubmit }: TaskFormProps) {
  const [values, setValues] = useState(initialValues);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!values.title.trim()) return;

    onSubmit(values);
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="task-title">
          Title
        </label>
        <Input
          id="task-title"
          onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}
          placeholder="Plan something meaningful"
          required
          value={values.title}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="task-description">
          Description
        </label>
        <textarea
          className={controlClassName}
          id="task-description"
          onChange={(event) =>
            setValues((current) => ({ ...current, description: event.target.value }))
          }
          placeholder="Add context, next steps, or a quick note"
          rows={4}
          value={values.description}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="task-status">
            Status
          </label>
          <select
            className={controlClassName}
            id="task-status"
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                status: event.target.value as TaskEditorValues['status'],
              }))
            }
            value={values.status}
          >
            {TASK_STATUS_VALUES.map((status) => (
              <option key={status} value={status}>
                {formatOptionLabel(status)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="task-priority">
            Priority
          </label>
          <select
            className={controlClassName}
            id="task-priority"
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                priority: event.target.value as TaskEditorValues['priority'],
              }))
            }
            value={values.priority}
          >
            {TASK_PRIORITY_VALUES.map((priority) => (
              <option key={priority} value={priority}>
                {formatOptionLabel(priority)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="task-category">
            Category
          </label>
          <select
            className={controlClassName}
            id="task-category"
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                category: event.target.value as TaskEditorValues['category'],
              }))
            }
            value={values.category}
          >
            {TASK_CATEGORY_VALUES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="task-due-date">
            Due date
          </label>
          <Input
            id="task-due-date"
            onChange={(event) =>
              setValues((current) => ({ ...current, dueDate: event.target.value }))
            }
            type="date"
            value={values.dueDate}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="task-recurrence">
            Recurrence
          </label>
          <select
            className={controlClassName}
            id="task-recurrence"
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                recurrence: event.target.value as TaskEditorValues['recurrence'],
                recurrenceInterval:
                  event.target.value === 'none' ? 1 : Math.max(1, current.recurrenceInterval),
              }))
            }
            value={values.recurrence}
          >
            {TASK_RECURRENCE_VALUES.map((recurrence) => (
              <option key={recurrence} value={recurrence}>
                {formatOptionLabel(recurrence)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="task-recurrence-interval">
            Interval
          </label>
          <Input
            disabled={values.recurrence === 'none'}
            id="task-recurrence-interval"
            min={1}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                recurrenceInterval: Math.max(1, Number.parseInt(event.target.value, 10) || 1),
              }))
            }
            type="number"
            value={values.recurrence === 'none' ? 1 : values.recurrenceInterval}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <Button type="submit">{mode === 'edit' ? 'Save changes' : 'Create task'}</Button>
        {mode === 'edit' && onCancel ? (
          <Button onClick={onCancel} type="button" variant="secondary">
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
