import { defaultTaskEditorValues, toTaskInput } from './task-data';
import type { QuickAddParseResult } from './quick-add-parser';
import type { TaskInput } from './types';

// `parseQuickAdd` applies no defaults — an absent field means "not specified",
// not "use the default". Choosing the defaults is a UI decision, and this is
// where it is made, so that every quick-add surface makes it identically.
export function toQuickAddTaskInput(parsed: QuickAddParseResult): TaskInput {
  return toTaskInput({
    ...defaultTaskEditorValues,
    title: parsed.title,
    dueDate: parsed.dueDate ?? '',
    category: parsed.category ?? defaultTaskEditorValues.category,
    priority: parsed.priority ?? defaultTaskEditorValues.priority,
  });
}
