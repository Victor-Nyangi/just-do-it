import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from './database.types'

let client: SupabaseClient<Database> | undefined

function requiredEnvironmentValue(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${name} is required. Add it to apps/just-do-it/.env.local.`)
  }

  return value
}

export function getSupabaseClient() {
  if (!client) {
    client = createClient<Database>(
      requiredEnvironmentValue(import.meta.env.VITE_SUPABASE_URL, 'VITE_SUPABASE_URL'),
      requiredEnvironmentValue(
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'VITE_SUPABASE_PUBLISHABLE_KEY',
      ),
    )
  }

  return client
}
