// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { useListStore } from '../features/lists';
import { ListDetailPage } from './list-detail-page';

// The fixture ships one list, `bucket-list`, holding "Visit Japan" then
// "Learn photography", neither complete and with no note. Nothing here reads
// the clock, so no clock is pinned.
function renderListDetail(listId: string) {
  return render(
    <MemoryRouter initialEntries={[`/lists/${listId}`]}>
      <Routes>
        <Route element={<ListDetailPage />} path="/lists/:listId" />
        <Route element={<h1>Lists index</h1>} path="/lists" />
      </Routes>
    </MemoryRouter>,
  );
}

function setUpUser() {
  return userEvent.setup();
}

// Reads the item order out of the rendered toggle buttons rather than the
// store, so a reorder test can tell that the *page* re-ordered rather than only
// that the store did. Each item's toggle is named "Mark <title> as complete" or
// "…as incomplete"; `getAllByRole` returns them in document order.
function getItemTitlesInOrder() {
  return screen
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label') ?? '')
    .filter((label) => /^Mark .+ as (complete|incomplete)$/u.test(label))
    .map((label) => label.replace(/^Mark /u, '').replace(/ as (complete|incomplete)$/u, ''));
}

describe('ListDetailPage — resolving the route parameter', () => {
  it('renders the list named in the path, with its items in order', () => {
    renderListDetail('bucket-list');

    expect(screen.getByRole('heading', { level: 1, name: 'Bucket List' })).toBeInTheDocument();
    expect(getItemTitlesInOrder()).toEqual(['Visit Japan', 'Learn photography']);
  });

  it('numbers each item by its position', () => {
    renderListDetail('bucket-list');

    expect(screen.getByText('Position 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Position 2 of 2')).toBeInTheDocument();
  });

  it('falls back to a not-found card for an unknown list', () => {
    renderListDetail('does-not-exist');

    expect(screen.getByRole('heading', { name: 'List not found' })).toBeInTheDocument();
  });
});

describe('ListDetailPage — item completion', () => {
  it('starts with nothing ticked off', () => {
    renderListDetail('bucket-list');

    expect(screen.getByRole('button', { name: 'Mark Visit Japan as complete' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('ticks an item off and back on', async () => {
    const user = setUpUser();
    renderListDetail('bucket-list');

    await user.click(screen.getByRole('button', { name: 'Mark Visit Japan as complete' }));

    expect(screen.getByRole('button', { name: 'Mark Visit Japan as incomplete' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Mark Visit Japan as incomplete' }));

    expect(screen.getByRole('button', { name: 'Mark Visit Japan as complete' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

describe('ListDetailPage — reordering', () => {
  it('cannot move the first item up or the last item down', () => {
    renderListDetail('bucket-list');

    expect(screen.getByRole('button', { name: 'Move Visit Japan up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Learn photography down' })).toBeDisabled();
  });

  it('moves an item down, swapping it with its neighbour', async () => {
    const user = setUpUser();
    renderListDetail('bucket-list');

    await user.click(screen.getByRole('button', { name: 'Move Visit Japan down' }));

    expect(getItemTitlesInOrder()).toEqual(['Learn photography', 'Visit Japan']);
    expect(useListStore.getState().lists[0]?.items.map((item) => item.title)).toEqual([
      'Learn photography',
      'Visit Japan',
    ]);
  });

  it('moves an item back up again', async () => {
    const user = setUpUser();
    renderListDetail('bucket-list');

    await user.click(screen.getByRole('button', { name: 'Move Visit Japan down' }));
    await user.click(screen.getByRole('button', { name: 'Move Visit Japan up' }));

    expect(getItemTitlesInOrder()).toEqual(['Visit Japan', 'Learn photography']);
  });

  // The move buttons swap which one is disabled as an item changes ends, so
  // this pins that the disabling follows the item rather than the title.
  it('moves the disabled state along with the item', async () => {
    const user = setUpUser();
    renderListDetail('bucket-list');

    await user.click(screen.getByRole('button', { name: 'Move Visit Japan down' }));

    expect(screen.getByRole('button', { name: 'Move Visit Japan down' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Visit Japan up' })).toBeEnabled();
  });
});

describe('ListDetailPage — adding and removing items', () => {
  it('appends a new item to the end', async () => {
    const user = setUpUser();
    renderListDetail('bucket-list');

    await user.type(screen.getByLabelText('New item'), 'Sail the Hebrides');
    await user.click(screen.getByRole('button', { name: 'Add item' }));

    expect(getItemTitlesInOrder()).toEqual([
      'Visit Japan',
      'Learn photography',
      'Sail the Hebrides',
    ]);
    expect(screen.getByText('Position 3 of 3')).toBeInTheDocument();
  });

  it('clears the field after adding, ready for the next one', async () => {
    const user = setUpUser();
    renderListDetail('bucket-list');

    await user.type(screen.getByLabelText('New item'), 'Sail the Hebrides');
    await user.click(screen.getByRole('button', { name: 'Add item' }));

    expect(screen.getByLabelText('New item')).toHaveValue('');
  });

  it('deletes an item and renumbers the rest', async () => {
    const user = setUpUser();
    renderListDetail('bucket-list');

    await user.click(screen.getByRole('button', { name: 'Delete Visit Japan' }));

    expect(getItemTitlesInOrder()).toEqual(['Learn photography']);
    expect(screen.getByText('Position 1 of 1')).toBeInTheDocument();
  });

  it('shows the empty state once the last item goes', async () => {
    const user = setUpUser();
    renderListDetail('bucket-list');

    await user.click(screen.getByRole('button', { name: 'Delete Visit Japan' }));
    await user.click(screen.getByRole('button', { name: 'Delete Learn photography' }));

    expect(screen.getByRole('heading', { name: 'No items yet' })).toBeInTheDocument();
  });
});

describe('ListDetailPage — renaming and notes', () => {
  // Two layers guard this, and only the outer one is reachable: the button is
  // disabled on `!normalizedName || !hasNameChanged`, and `handleRenameList`
  // re-checks the identical condition. A disabled submit button also suppresses
  // implicit form submission, so Enter cannot reach the handler either — which
  // makes the inner check unkillable on its own by any UI-level test. Removing
  // both at once is caught, by this assertion.
  it('cannot save a name that has not changed', () => {
    renderListDetail('bucket-list');

    expect(screen.getByRole('button', { name: 'Save name' })).toBeDisabled();
  });

  it('renames the list, updating the heading and the store', async () => {
    const user = setUpUser();
    renderListDetail('bucket-list');

    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Someday list');
    await user.click(screen.getByRole('button', { name: 'Save name' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Someday list' })).toBeInTheDocument();
    expect(useListStore.getState().lists[0]?.name).toBe('Someday list');
  });

  it('cannot save a note until one is written', () => {
    renderListDetail('bucket-list');

    expect(screen.getByRole('button', { name: 'Save note' })).toBeDisabled();
  });

  it('saves a note to the list', async () => {
    const user = setUpUser();
    renderListDetail('bucket-list');

    await user.type(screen.getByLabelText('Note'), 'Ordered by how soon they are affordable.');
    await user.click(screen.getByRole('button', { name: 'Save note' }));

    expect(useListStore.getState().lists[0]?.note).toBe('Ordered by how soon they are affordable.');
  });

  it('clears a saved note back to nothing', async () => {
    const user = setUpUser();
    renderListDetail('bucket-list');

    await user.type(screen.getByLabelText('Note'), 'Temporary context.');
    await user.click(screen.getByRole('button', { name: 'Save note' }));
    await user.click(screen.getByRole('button', { name: 'Clear note' }));

    expect(screen.getByLabelText('Note')).toHaveValue('');
    expect(useListStore.getState().lists[0]?.note).toBeUndefined();
  });
});
