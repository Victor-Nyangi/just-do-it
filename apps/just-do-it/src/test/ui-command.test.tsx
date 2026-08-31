// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Command, type CommandOption } from '@just-do-it/ui';

// `packages/ui` has no vitest of its own, so its components are covered from
// the app. This file is the primitive's only direct test; the palette that
// consumes it is tested separately in features/command-palette.
const options: CommandOption[] = [
  { id: 'today', group: 'Navigate', label: 'Today', hint: 'g t' },
  { id: 'tasks', group: 'Navigate', label: 'Tasks', hint: 'g k' },
  { id: 'theme', group: 'Actions', label: 'Toggle dark mode' },
];

function Harness({
  onSelect = () => {},
  onDismiss = () => {},
  visible = options,
}: {
  onSelect?: (optionId: string) => void;
  onDismiss?: () => void;
  visible?: readonly CommandOption[];
}) {
  const [query, setQuery] = useState('');

  return (
    <Command
      ariaLabel="Command palette"
      emptyLabel="No matching commands"
      onDismiss={onDismiss}
      onQueryChange={setQuery}
      onSelect={onSelect}
      options={visible}
      placeholder="Type a command"
      query={query}
    />
  );
}

describe('Command — structure', () => {
  it('is a labelled modal dialog', () => {
    render(<Harness />);

    const dialog = screen.getByRole('dialog', { name: 'Command palette' });

    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('gives the input a combobox role wired to the listbox', () => {
    render(<Harness />);

    const input = screen.getByRole('combobox', { name: 'Command palette' });

    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', screen.getByRole('listbox').id);
  });

  it('renders every option as an option, grouped', () => {
    render(<Harness />);

    expect(screen.getByRole('option', { name: /Today/u })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Navigate' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Actions' })).toBeInTheDocument();
  });

  it('focuses the input on mount', () => {
    render(<Harness />);

    expect(screen.getByRole('combobox', { name: 'Command palette' })).toHaveFocus();
  });

  // Without this, closing the palette leaves focus on document.body and the
  // next Tab restarts from the top of the page.
  it('returns focus where it came from when it unmounts', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();

    const { unmount } = render(<Harness />);
    expect(trigger).not.toHaveFocus();

    unmount();
    expect(trigger).toHaveFocus();

    trigger.remove();
  });

  it('shows the empty label when there is nothing to show', () => {
    render(<Harness visible={[]} />);

    expect(screen.getByText('No matching commands')).toBeInTheDocument();
  });
});

describe('Command — keyboard', () => {
  it('marks the first option active on mount', () => {
    render(<Harness />);

    expect(screen.getByRole('option', { name: /Today/u })).toHaveAttribute('aria-selected', 'true');
  });

  // Focus must stay in the input so typing keeps working; the active option is
  // tracked with aria-activedescendant instead.
  it('keeps focus in the input while arrowing', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.keyboard('{ArrowDown}');

    const input = screen.getByRole('combobox', { name: 'Command palette' });

    expect(input).toHaveFocus();
    expect(screen.getByRole('option', { name: /Tasks/u })).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: /Tasks/u }).id,
    );
  });

  it('wraps from the last option back to the first', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.keyboard('{ArrowUp}');

    expect(screen.getByRole('option', { name: 'Toggle dark mode' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  // The test above arrows *up* off the first option, which is the backwards
  // wrap. Arrowing down off the end is the other direction, and it is the one
  // the `% options.length` in `moveActiveIndex` exists for: a mutation that
  // clamps forward movement instead of wrapping leaves every other test green.
  it('wraps forward from the last option to the first', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');

    expect(screen.getByRole('option', { name: /Today/u })).toHaveAttribute('aria-selected', 'true');
  });

  it('selects the active option on Enter', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);

    await user.keyboard('{ArrowDown}{Enter}');

    expect(onSelect).toHaveBeenCalledWith('tasks');
  });

  it('dismisses on Escape', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} />);

    await user.keyboard('{Escape}');

    expect(onDismiss).toHaveBeenCalled();
  });

  it('does nothing on Enter when there is nothing to select', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} visible={[]} />);

    await user.keyboard('{Enter}');

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('selects an option that is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);

    await user.click(screen.getByRole('option', { name: 'Toggle dark mode' }));

    expect(onSelect).toHaveBeenCalledWith('theme');
  });
});
