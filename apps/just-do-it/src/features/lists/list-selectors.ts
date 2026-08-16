import type { List } from './types'

export function selectListById(lists: readonly List[], listId: string): List | null {
  return lists.find((list) => list.id === listId) ?? null
}
