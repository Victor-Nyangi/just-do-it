import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Command, type CommandOption } from '@just-do-it/ui';
import { parseQuickAdd, toQuickAddTaskInput, useCreateTask } from '../tasks';
import { buildCommands } from './commands';
import type { CommandMode } from './types';
import { useGlobalShortcuts } from './use-global-shortcuts';

export function CommandPalette({ onToggleTheme }: { onToggleTheme: () => void }) {
  const navigate = useNavigate();
  const createTask = useCreateTask();

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<CommandMode>('root');
  const [query, setQuery] = useState('');

  const commands = useMemo(
    () => buildCommands({ navigate, toggleTheme: onToggleTheme }),
    [navigate, onToggleTheme],
  );

  useGlobalShortcuts({
    onNavigate: navigate,
    onOpenPalette: () => {
      setMode('root');
      setQuery('');
      setIsOpen(true);
    },
  });

  function close() {
    setIsOpen(false);
    setMode('root');
    setQuery('');
  }

  if (!isOpen) return null;

  if (mode === 'new-task') {
    const parsed = parseQuickAdd(query);

    // Both modes return a `Command` from the same position in the tree, so React
    // reuses one instance across the switch and its focus-on-mount effect never
    // re-runs — leaving focus wherever the click that changed mode dropped it
    // (`document.body`), where the primitive's key handling cannot see it.
    // Keying by mode remounts the dialog so each mode gets its input focused.
    return (
      <Command
        ariaLabel="New task"
        key="new-task"
        emptyLabel="Type a title, and optionally a day, #category or !priority."
        onDismiss={() => {
          setMode('root');
          setQuery('');
        }}
        onQueryChange={setQuery}
        onSelect={() => {
          if (parsed.title.length === 0) return;

          createTask(toQuickAddTaskInput(parsed));
          close();
        }}
        options={
          parsed.title.length > 0
            ? [
                {
                  id: 'quick-add-preview',
                  group: 'Create',
                  label: parsed.title,
                  hint: parsed.dueDate ?? 'No date',
                },
              ]
            : []
        }
        placeholder="Read 20 pages Friday #Reading !high"
        query={query}
      />
    );
  }

  const normalizedQuery = query.trim().toLowerCase();
  const visibleCommands = commands.filter((command) =>
    command.label.toLowerCase().includes(normalizedQuery),
  );
  const options: CommandOption[] = visibleCommands.map((command) => ({
    id: command.id,
    group: command.group,
    label: command.label,
    hint: command.hint,
  }));

  return (
    <Command
      ariaLabel="Command palette"
      key="root"
      emptyLabel="No matching commands"
      onDismiss={close}
      onQueryChange={setQuery}
      onSelect={(optionId) => {
        const command = commands.find((candidate) => candidate.id === optionId);
        if (!command) return;

        const nextMode = command.run();

        if (nextMode) {
          setMode(nextMode);
          setQuery('');
          return;
        }

        close();
      }}
      options={options}
      placeholder="Type a command"
      query={query}
    />
  );
}
