import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { announceDataChange, useDataChanges } from '@/lib/dataEvents'
import type { Party } from '@/types'

export function useParties(includeInactive = false) {
  const [parties, setParties] = useState<Party[]>([])
  const [loading, setLoading] = useState(true)

  const fetchParties = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('parties')
      .select('*')
      .is('deleted_at', null)
      .order('name')

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query
    if (!error && data) setParties(data as Party[])
    setLoading(false)
  }, [includeInactive])

  useEffect(() => {
    fetchParties()
  }, [fetchParties])
  useDataChanges(fetchParties)

  const createParty = async (party: Omit<Party, 'id' | 'user_id' | 'deleted_at' | 'created_at'>) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('parties')
      .insert({ ...party, user_id: user.id })
      .select()
      .single()

    if (!error) announceDataChange()
    return { data, error: error?.message }
  }

  const updateParty = async (id: string, updates: Partial<Party>) => {
    const { error } = await supabase.from('parties').update(updates).eq('id', id)
    if (!error) announceDataChange()
    return { error: error?.message }
  }

  const softDeleteParty = async (id: string) => {
    const { error } = await supabase
      .from('parties')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (!error) announceDataChange()
    return { error: error?.message }
  }

  return { parties, loading, fetchParties, createParty, updateParty, softDeleteParty }
}
