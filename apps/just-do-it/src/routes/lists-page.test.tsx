// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { useListStore } from '../features/lists';
import { ListsPage } from './lists-page';

// No clock is pinned here: nothing on this route reads `new Date()`, and the
// list fixture carries no dates. The other route suites pin one because their
// pages do.

// Creating a list navigates straight to its detail page, so the route has to be
// mounted with a `/lists/:listId` sibling for that to be observable. The stub
// echoes the id, which is what lets the create test prove it navigated to the
// *new* list rather than merely to some list page.
function renderLists() {
  return render(
    <MemoryRouter initialEntries={['/lists']}>
      <Routes>
        <Route element={<ListsPage />} path="/lists" />
        <Route element={<h1>Detail stub</h1>} path="/lists/:listId" />
      </Routes>
    </MemoryRouter>,
  );
}

function setUpUser() {
  return userEvent.setup();
}

// The page prints "2 items" twice — once on the list's own card and once as a
// whole-page total, which happen to agree while there is a single list. Card
// assertions are scoped to the card's `<article>` so they cannot accidentally
// be satisfied by the total.
function getListCard(name: string) {
  const card = screen
    .getAllByRole('article')
    .find((candidate) => within(candidate).queryByRole('heading', { name }));
  if (!card) throw new Error(`expected a card for the list ${name}`);

  return within(card);
}

describe('ListsPage — the list of lists', () => {
  it('shows the fixture list with its item count and progress', () => {
    renderLists();

    const card = getListCard('Bucket List');

    expect(card.getByText('2 items')).toBeInTheDocument();
    expect(card.getByText('0/2 done')).toBeInTheDocument();
  });

  it('offers a way into the list', () => {
    renderLists();

    expect(screen.getByRole('link', { name: 'Open list' })).toHaveAttribute(
      'href',
      '/lists/bucket-list',
    );
  });

  it('stands in for a missing note rather than showing an empty gap', () => {
    renderLists();

    expect(
      screen.getByText('No notes yet. Open the list to add context for this session.'),
    ).toBeInTheDocument();
  });
});

describe('ListsPage — the composer', () => {
  it('creates a list and opens it', async () => {
    const user = setUpUser();
    renderLists();

    await user.type(screen.getByLabelText('List name'), 'Weekend reset');
    await user.click(screen.getByRole('button', { name: 'Create and open' }));

    // Navigated away from the index to the new list's detail route.
    expect(screen.getByRole('heading', { name: 'Detail stub' })).toBeInTheDocument();

    const created = useListStore.getState().lists.find((list) => list.name === 'Weekend reset');

    expect(created).toBeDefined();
    expect(created?.items).toEqual([]);
  });

  // `listSchema` requires a non-empty name, so a whitespace-only one throws if
  // it reaches the store rather than being written — which leaves "no list was
  // created" true either way. The window `error` listener separates a clean
  // refusal from a crash; see quick-add-field.test.tsx for the same pattern.
  it('refuses a name that is only whitespace, without throwing', async () => {
    const user = setUpUser();
    const countBefore = useListStore.getState().lists.length;
    const uncaught: string[] = [];
    const recordError = (event: ErrorEvent) => {
      uncaught.push(String(event.error ?? event.message));
    };
    window.addEventListener('error', recordError);

    try {
      renderLists();

      await user.type(screen.getByLabelText('List name'), '   ');
      await user.click(screen.getByRole('button', { name: 'Create and open' }));

      expect(useListStore.getState().lists).toHaveLength(countBefore);
      // Still on the index, because nothing was created to navigate to.
      expect(screen.getByRole('heading', { name: 'Lists' })).toBeInTheDocument();
      expect(uncaught).toEqual([]);
    } finally {
      window.removeEventListener('error', recordError);
    }
  });
});
