import { Badge, Button, cn } from '@just-do-it/ui';
import { TASK_CATEGORY_VALUES, TASK_PRIORITY_VALUES, type TaskFilters } from '../types';

type TaskFiltersProps = {
  filters: TaskFilters;
  hasFiltersApplied: boolean;
  showDueDates: boolean;
  showRecurrence: boolean;
  onCategoryChange: (category: TaskFilters['category']) => void;
  onClearFilters: () => void;
  onPriorityChange: (priority: TaskFilters['priority']) => void;
  onToggleDueDates: () => void;
  onToggleRecurrence: () => void;
};

const controlClassName =
  'min-h-10 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]';

function VisibilityToggle({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'border-[var(--primary)] bg-[var(--primary-subtle)] text-[var(--primary)]'
          : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]',
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

export function TaskFiltersPanel({
  filters,
  hasFiltersApplied,
  showDueDates,
  showRecurrence,
  onCategoryChange,
  onClearFilters,
  onPriorityChange,
  onToggleDueDates,
  onToggleRecurrence,
}: TaskFiltersProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Filters</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Narrow the list without losing your session-local state.
          </p>
        </div>
        {hasFiltersApplied ? <Badge tone="accent">Filtered</Badge> : <Badge>All tasks</Badge>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="task-priority-filter">
            Priority
          </label>
          <select
            className={controlClassName}
            id="task-priority-filter"
            onChange={(event) => onPriorityChange(event.target.value as TaskFilters['priority'])}
            value={filters.priority}
          >
            <option value="all">All priorities</option>
            {TASK_PRIORITY_VALUES.map((priority) => (
              <option key={priority} value={priority}>
                {priority.replace(/\b\w/gu, (character) => character.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="task-category-filter">
            Category
          </label>
          <select
            className={controlClassName}
            id="task-category-filter"
            onChange={(event) => onCategoryChange(event.target.value as TaskFilters['category'])}
            value={filters.category}
          >
            <option value="all">All categories</option>
            {TASK_CATEGORY_VALUES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <VisibilityToggle active={showDueDates} label="Show due dates" onClick={onToggleDueDates} />
        <VisibilityToggle
          active={showRecurrence}
          label="Show recurrence"
          onClick={onToggleRecurrence}
        />
        {hasFiltersApplied ? (
          <Button onClick={onClearFilters} variant="ghost">
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}
