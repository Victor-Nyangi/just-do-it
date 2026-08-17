import { create } from 'zustand'

import { cloneListItem, getInitialLists, listItemSchema, listSchema } from './list-data'
import type { List, ListInput, ListItem, ListItemInput, ListItemUpdateInput, ListUpdateInput } from './types'

type ListStoreState = {
  lists: List[]
  createList: (input: ListInput) => string
  updateList: (listId: string, input: ListUpdateInput) => void
  reorderLists: (fromIndex: number, toIndex: number) => void
  deleteList: (listId: string) => void
  createListItem: (listId: string, input: ListItemInput) => void
  updateListItem: (listId: string, itemId: string, input: ListItemUpdateInput) => void
  toggleListItem: (listId: string, itemId: string) => void
  reorderListItems: (listId: string, fromIndex: number, toIndex: number) => void
  deleteListItem: (listId: string, itemId: string) => void
}

function isValidIndex(items: readonly unknown[], index: number): boolean {
  return index >= 0 && index < items.length
}

function moveArrayItem<TItem>(items: readonly TItem[], fromIndex: number, toIndex: number): TItem[] {
  if (!isValidIndex(items, fromIndex) || !isValidIndex(items, toIndex) || fromIndex === toIndex) {
    return [...items]
  }

  const nextItems = [...items]
  const [item] = nextItems.splice(fromIndex, 1)
  nextItems.splice(toIndex, 0, item)

  return nextItems
}

function buildListRecord(listId: string, input: ListUpdateInput, existingList?: List): List {
  return listSchema.parse({
    id: existingList?.id ?? listId,
    name: input.name ?? existingList?.name,
    note: input.note ?? existingList?.note,
    items: existingList ? existingList.items.map(cloneListItem) : [],
  })
}

function buildListItemRecord(itemId: string, input: ListItemUpdateInput, existingItem?: ListItem): ListItem {
  return listItemSchema.parse({
    id: existingItem?.id ?? itemId,
    title: input.title ?? existingItem?.title,
    complete: input.complete ?? existingItem?.complete ?? false,
  })
}

function replaceListItems(list: List, items: ListItem[]): List {
  return listSchema.parse({
    ...list,
    items,
  })
}

export const useListStore = create<ListStoreState>()((set) => ({
  lists: getInitialLists(),
  createList: (input) => {
    const listId = crypto.randomUUID()

    set((state) => ({
      lists: [...state.lists, buildListRecord(listId, input)],
    }))

    return listId
  },
  updateList: (listId, input) => {
    set((state) => ({
      lists: state.lists.map((list) =>
        list.id === listId ? buildListRecord(listId, input, list) : list,
      ),
    }))
  },
  reorderLists: (fromIndex, toIndex) => {
    set((state) => ({
      lists: moveArrayItem(state.lists, fromIndex, toIndex),
    }))
  },
  deleteList: (listId) => {
    set((state) => ({
      lists: state.lists.filter((list) => list.id !== listId),
    }))
  },
  createListItem: (listId, input) => {
    set((state) => ({
      lists: state.lists.map((list) => {
        if (list.id !== listId) return list

        return replaceListItems(list, [...list.items, buildListItemRecord(crypto.randomUUID(), input)])
      }),
    }))
  },
  updateListItem: (listId, itemId, input) => {
    set((state) => ({
      lists: state.lists.map((list) => {
        if (list.id !== listId) return list

        return replaceListItems(
          list,
          list.items.map((item) =>
            item.id === itemId ? buildListItemRecord(itemId, input, item) : item,
          ),
        )
      }),
    }))
  },
  toggleListItem: (listId, itemId) => {
    set((state) => ({
      lists: state.lists.map((list) => {
        if (list.id !== listId) return list

        return replaceListItems(
          list,
          list.items.map((item) =>
            item.id === itemId
              ? buildListItemRecord(itemId, { complete: !item.complete }, item)
              : item,
          ),
        )
      }),
    }))
  },
  reorderListItems: (listId, fromIndex, toIndex) => {
    set((state) => ({
      lists: state.lists.map((list) =>
        list.id === listId
          ? replaceListItems(list, moveArrayItem(list.items, fromIndex, toIndex))
          : list,
      ),
    }))
  },
  deleteListItem: (listId, itemId) => {
    set((state) => ({
      lists: state.lists.map((list) =>
        list.id === listId
          ? replaceListItems(
              list,
              list.items.filter((item) => item.id !== itemId),
            )
          : list,
      ),
    }))
  },
}))
