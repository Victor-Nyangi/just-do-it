import { describe, expect, it } from 'vitest';

import { getInitialLists } from './list-data';
import { selectListById } from './list-selectors';

describe('selectListById', () => {
  it('returns the list with the matching id', () => {
    const lists = getInitialLists();
    const targetList = lists[0];

    expect(selectListById(lists, targetList.id)).toEqual(targetList);
  });

  it('returns null when no list matches', () => {
    expect(selectListById(getInitialLists(), 'no-such-list')).toBeNull();
  });

  it('returns null for an empty collection', () => {
    expect(selectListById([], 'anything')).toBeNull();
  });
});
