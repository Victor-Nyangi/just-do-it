import { z } from 'zod'

import booksFixture from './books.json'
import { validatedTaskFixture } from '../features/tasks/task-data'
import goalsFixture from './goals.json'
import habitsFixture from './habits.json'
import listsFixture from './lists.json'

const habitSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  days: z.array(z.boolean()).length(5),
})

const goalSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
  period: z.string().min(1),
  progress: z.number().min(0).max(100),
  remainingLabel: z.string().min(1),
})

const bookSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  author: z.string().min(1),
  status: z.enum(['want_to_read', 'reading', 'finished', 'abandoned']),
})

const listSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string().min(1),
      complete: z.boolean(),
    }),
  ),
})

export const dashboardData = {
  tasks: validatedTaskFixture,
  habits: z.array(habitSchema).parse(habitsFixture),
  goal: z.array(goalSchema).min(1).parse(goalsFixture)[0],
}

export const staticData = {
  books: z.array(bookSchema).parse(booksFixture),
  lists: z.array(listSchema).parse(listsFixture),
}
