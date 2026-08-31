export type CommandMode = 'root' | 'new-task';

export type CommandGroup = 'Navigate' | 'Actions';

export type CommandItem = {
  id: string;
  group: CommandGroup;
  label: string;
  hint?: string;
  // Returning a mode switches the palette into it; returning nothing closes it.
  run: () => CommandMode | void;
};
