export type ListItem = {
  id: string
  title: string
  complete: boolean
}

export type List = {
  id: string
  name: string
  items: ListItem[]
}

export type ListInput = {
  name: string
}

export type ListUpdateInput = Partial<Pick<List, 'name'>>

export type ListItemInput = {
  title: string
  complete?: boolean
}

export type ListItemUpdateInput = Partial<Pick<ListItem, 'complete' | 'title'>>
