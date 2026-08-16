import { z } from 'zod'

import listsFixture from '../../data/lists.json'
import type { List, ListItem } from './types'

export const listItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  complete: z.boolean(),
})

export const listSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  items: z.array(listItemSchema),
})

export const listCollectionSchema = z.array(listSchema)

const validatedListFixture = listCollectionSchema.parse(listsFixture)

export function cloneListItem(item: ListItem): ListItem {
  return { ...item }
}

export function cloneList(list: List): List {
  return {
    ...list,
    items: list.items.map(cloneListItem),
  }
}

export function getInitialLists(): List[] {
  return validatedListFixture.map(cloneList)
}

export { validatedListFixture }
