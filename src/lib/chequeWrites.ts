import { supabase } from '@/lib/supabase'
import { announceDataChange } from '@/lib/dataEvents'
import type { TablesUpdate } from '@/types/database'

/** A given cheque as the add form sends it. */
export interface NewGivenCheque {
  party_id: string
  cheque_number: string
  bank_name: string
  amount: number
  issue_date: string
  due_date: string
  notes?: string
  replaces_cheque_id?: string
}

/** Adds a given cheque as Pending. Status changes go through the SQL functions instead. */
export async function createGivenCheque(cheque: NewGivenCheque): Promise<{ error?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { error } = await supabase.from('cheques').insert({ ...cheque, user_id: user.id, status: 'PENDING' })
  if (error) return { error: error.message }
  announceDataChange()
  return {}
}

export async function updateGivenCheque(id: string, updates: TablesUpdate<'cheques'>): Promise<{ error?: string }> {
  const { error } = await supabase.from('cheques').update(updates).eq('id', id)
  if (error) return { error: error.message }
  announceDataChange()
  return {}
}
