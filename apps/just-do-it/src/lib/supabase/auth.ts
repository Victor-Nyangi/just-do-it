import { getSupabaseClient } from './client'

export function signInWithPassword(email: string, password: string) {
  return getSupabaseClient().auth.signInWithPassword({ email, password })
}

export function signUpWithPassword(email: string, password: string) {
  return getSupabaseClient().auth.signUp({ email, password })
}

export function signOut() {
  return getSupabaseClient().auth.signOut()
}

export function getCurrentSession() {
  return getSupabaseClient().auth.getSession()
}
