import { supabase } from './supabase'
import { announceDataChange } from './dataEvents'

/**
 * The made-up sample set that earlier versions added from Settings (plan item
 * 11). The demo replaced it (plan item 86, migration 023, which holds the same
 * cheques), so only removing it is left, for accounts that still have it.
 * Delete this file once none do.
 */
export const SAMPLE_NOTE = 'Sample data. Remove it in Settings → Sample data.'
export const SAMPLE_ACCOUNT = { name: 'Sample account', bank_name: 'Northwind Bank', last4: '0000' }

type Result = { error?: string }

/** Whether the account has any sample data to remove. */
export async function hasSampleData(): Promise<boolean> {
  const { count } = await supabase.from('parties').select('id', { count: 'exact', head: true }).eq('notes', SAMPLE_NOTE).is('deleted_at', null)
  return (count ?? 0) > 0
}

/** Removes everything the sample added. Cheques are kept in the database, marked deleted, like any delete in the app. */
export async function removeSampleData(): Promise<Result> {
  const now = new Date().toISOString()
  const steps = [
    supabase.from('received_cheques').update({ deleted_at: now }).like('notes', `%${SAMPLE_NOTE}`).is('deleted_at', null),
    supabase.from('cheques').update({ deleted_at: now }).eq('notes', SAMPLE_NOTE).is('deleted_at', null),
    supabase
      .from('bank_accounts')
      .update({ deleted_at: now, is_default: false })
      .eq('name', SAMPLE_ACCOUNT.name)
      .eq('last4', SAMPLE_ACCOUNT.last4)
      .is('deleted_at', null),
    supabase.from('parties').update({ deleted_at: now }).eq('notes', SAMPLE_NOTE).is('deleted_at', null),
  ]
  for (const step of steps) {
    const { error } = await step
    if (error) return { error: error.message }
  }
  announceDataChange()
  return {}
}
