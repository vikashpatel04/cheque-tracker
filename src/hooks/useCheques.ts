import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Cheque, ChequeStatus } from '@/types'
import type { TablesUpdate } from '@/types/database'

export interface ChequeFilters {
  status?: ChequeStatus[]
  partyId?: string
  bank?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

export function useCheques(filters?: ChequeFilters) {
  const [cheques, setCheques] = useState<Cheque[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCheques = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('cheques')
      .select('*, party:parties(*)')
      .is('deleted_at', null)
      .order('due_date', { ascending: true })

    if (filters?.status?.length) {
      query = query.in('status', filters.status)
    }
    if (filters?.partyId) {
      query = query.eq('party_id', filters.partyId)
    }
    if (filters?.bank) {
      query = query.ilike('bank_name', `%${filters.bank}%`)
    }
    if (filters?.dateFrom) {
      query = query.gte('due_date', filters.dateFrom)
    }
    if (filters?.dateTo) {
      query = query.lte('due_date', filters.dateTo)
    }

    const { data, error } = await query
    if (!error && data) {
      let result = data as Cheque[]
      if (filters?.search) {
        const s = filters.search.toLowerCase()
        result = result.filter(
          (c) =>
            c.cheque_number.toLowerCase().includes(s) ||
            c.party?.name?.toLowerCase().includes(s)
        )
      }
      setCheques(result)
    }
    setLoading(false)
  }, [filters?.status, filters?.partyId, filters?.bank, filters?.dateFrom, filters?.dateTo, filters?.search])

  useEffect(() => {
    fetchCheques()
  }, [fetchCheques])

  const createCheque = async (cheque: {
    party_id: string
    cheque_number: string
    bank_name: string
    amount: number
    issue_date: string
    due_date: string
    notes?: string
    replaces_cheque_id?: string
  }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('cheques')
      .insert({ ...cheque, user_id: user.id, status: 'PENDING' })
      .select('*, party:parties(*)')
      .single()

    if (!error) await fetchCheques()
    return { data, error: error?.message }
  }

  const updateCheque = async (id: string, updates: TablesUpdate<'cheques'>) => {
    const { error } = await supabase.from('cheques').update(updates).eq('id', id)
    if (!error) await fetchCheques()
    return { error: error?.message }
  }

  const softDeleteCheque = async (id: string) => {
    const { error } = await supabase
      .from('cheques')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (!error) await fetchCheques()
    return { error: error?.message }
  }

  return { cheques, loading, fetchCheques, createCheque, updateCheque, softDeleteCheque }
}
