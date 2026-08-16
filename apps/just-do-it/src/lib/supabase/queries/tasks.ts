import type { Database } from '../database.types'
import { getSupabaseClient } from '../client'

export type Task = Database['public']['Tables']['tasks']['Row']
export type TaskInsert = Database['public']['Tables']['tasks']['Insert']
export type TaskUpdate = Database['public']['Tables']['tasks']['Update']

export async function getTasks() {
  const { data, error } = await getSupabaseClient()
    .from('tasks')
    .select()
    .order('completed_at', { ascending: true, nullsFirst: true })
    .order('due_date', { ascending: true, nullsFirst: true })

  if (error) throw error

  return data
}

export async function createTask(task: TaskInsert) {
  const { data, error } = await getSupabaseClient().from('tasks').insert(task).select().single()

  if (error) throw error

  return data
}

export async function updateTask(id: string, task: TaskUpdate) {
  const { data, error } = await getSupabaseClient()
    .from('tasks')
    .update(task)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  return data
}

export async function deleteTask(id: string) {
  const { error } = await getSupabaseClient().from('tasks').delete().eq('id', id)

  if (error) throw error
}
