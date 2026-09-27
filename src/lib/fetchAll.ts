import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { supabase } from './supabase'

/** Rows asked for per request. The server may return fewer (its max_rows). */
const PAGE_SIZE = 1000

/**
 * Every row of a table, fetched page by page. A single request returns at
 * most the server's max_rows (1,000 by default), which would silently cut
 * exports short. Pages are ordered by id so none are skipped or repeated.
 */
export async function fetchAllRows<T>(
  table: keyof Database['public']['Tables'],
  columns = '*',
  options: { activeOnly?: boolean } = {}
): Promise<{ rows: T[]; error?: string }> {
  // The table and columns are only known at run time, so the rows can't be
  // typed here; the caller names their type instead.
  const untyped = supabase as unknown as SupabaseClient
  const rows: T[] = []
  let from = 0
  for (;;) {
    let query = untyped.from(table).select(columns).order('id').range(from, from + PAGE_SIZE - 1)
    if (options.activeOnly) query = query.is('deleted_at', null)
    const { data, error } = await query
    if (error) return { rows, error: `${table}: ${error.message}` }
    if (!data?.length) return { rows }
    rows.push(...(data as T[]))
    from += data.length
  }
}
