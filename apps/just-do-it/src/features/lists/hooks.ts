import { selectListById } from './list-selectors'
import { useListStore } from './list-store'

export function useLists() {
  return useListStore((state) => state.lists)
}

export function useList(listId: string) {
  return useListStore((state) => selectListById(state.lists, listId))
}

export function useCreateList() {
  return useListStore((state) => state.createList)
}

export function useUpdateList() {
  return useListStore((state) => state.updateList)
}

export function useReorderLists() {
  return useListStore((state) => state.reorderLists)
}

export function useDeleteList() {
  return useListStore((state) => state.deleteList)
}

export function useCreateListItem() {
  return useListStore((state) => state.createListItem)
}

export function useUpdateListItem() {
  return useListStore((state) => state.updateListItem)
}

export function useToggleListItem() {
  return useListStore((state) => state.toggleListItem)
}

export function useReorderListItems() {
  return useListStore((state) => state.reorderListItems)
}

export function useDeleteListItem() {
  return useListStore((state) => state.deleteListItem)
}
