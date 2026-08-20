import { beforeEach, describe, expect, it } from 'vitest';

import { getInitialLists } from './list-data';
import { useListStore } from './list-store';

function findList(listId: string) {
  return useListStore.getState().lists.find((list) => list.id === listId);
}

describe('useListStore', () => {
  beforeEach(() => {
    useListStore.setState({ lists: getInitialLists() });
  });

  it('clears the note when an explicit undefined is passed', () => {
    const listId = useListStore.getState().createList({ name: 'Trip prep', note: 'Pack early' });
    expect(findList(listId)?.note).toBe('Pack early');

    useListStore.getState().updateList(listId, { note: undefined });

    expect(findList(listId)?.note).toBeUndefined();
  });

  it('keeps the note when the key is absent from a partial update', () => {
    const listId = useListStore.getState().createList({ name: 'Trip prep', note: 'Pack early' });

    useListStore.getState().updateList(listId, { name: 'Trip prep, renamed' });

    const updatedList = findList(listId);
    expect(updatedList?.note).toBe('Pack early');
    expect(updatedList?.name).toBe('Trip prep, renamed');
  });
});
