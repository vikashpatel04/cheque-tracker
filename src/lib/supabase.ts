import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { isReadOnly, needsPlan, PLAN_ENDED_MESSAGE } from '@/lib/plan'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
}

/**
 * Once the account is known to be read-only, changes are answered here the
 * way the database would answer them, so no save quietly does nothing.
 */
const planAwareFetch: typeof fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
  if (isReadOnly() && needsPlan(url, method)) {
    const body = JSON.stringify({ code: '42501', message: PLAN_ENDED_MESSAGE, details: null, hint: null })
    return Promise.resolve(new Response(body, { status: 403, headers: { 'Content-Type': 'application/json' } }))
  }
  return fetch(input, init)
}

export const supabase = createClient<Database>(
  supabaseUrl ?? '',
  supabaseAnonKey ?? '',
  { global: { fetch: planAwareFetch } }
)
