import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { announceDataChange, useDataChanges } from '@/lib/dataEvents'
import { todayISO } from '@/lib/formatters'
import { recordDeposit } from '@/lib/updateChequeStatus'
import type { DailyDeposit } from '@/types'

export function useDeposits() {
  const [todayTotal, setTodayTotal] = useState(0)
  const [deposits, setDeposits] = useState<DailyDeposit[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTodayTotal = useCallback(async () => {
    const today = todayISO()
    const { data } = await supabase
      .from('daily_deposits')
      .select('amount')
      .eq('deposit_date', today)

    const total = (data ?? []).reduce((sum, d) => sum + Number(d.amount), 0)
    setTodayTotal(total)
  }, [])

  const fetchAllDeposits = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('daily_deposits')
      .select('*')
      .order('deposit_date', { ascending: false })

    if (data) setDeposits(data as DailyDeposit[])
    setLoading(false)
  }, [])

  const refresh = useCallback(() => {
    void fetchTodayTotal()
    void fetchAllDeposits()
  }, [fetchTodayTotal, fetchAllDeposits])

  useEffect(refresh, [refresh])
  useDataChanges(refresh)

  /** Log today's deposit and mark the allocated cheques DEPOSITED, atomically. */
  const addDeposit = async (amount: number, chequeIds: string[], notes?: string) => {
    const result = await recordDeposit(amount, todayISO(), chequeIds, notes)
    // Funds added also mark cheques Funded, so every list refreshes.
    if (result.success) announceDataChange()
    return { error: result.error }
  }

  return { todayTotal, deposits, loading, addDeposit, fetchTodayTotal, fetchAllDeposits }
}
