import { useCallback, useEffect, useRef, useState } from 'react'
import { useChequeListData } from './useChequeListData'
import { useDataChanges } from '@/lib/dataEvents'
import { fetchAllRows } from '@/lib/fetchAll'
import { isoDateOf } from '@/lib/formatters'
import type { DailyDeposit } from '@/types'

interface HistoryRow {
  id: string
  cheque_id: string
  to_status: string
  changed_by: string
  created_at: string
  reverts_history_id: string | null
}

/**
 * Everything Reports needs: every cheque both ways (the Cheques list's rows),
 * every "Add funds", and from the given cheques' history which ones came back
 * and the day each passed. Changes that were undone don't count. Refreshed
 * after any save.
 */
export function useReportsData() {
  const list = useChequeListData()
  const [deposits, setDeposits] = useState<DailyDeposit[]>([])
  const [everReturned, setEverReturned] = useState<Set<string>>(new Set())
  const [passedOn, setPassedOn] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const latest = useRef(0)

  const load = useCallback(async () => {
    const run = ++latest.current
    const [funds, history] = await Promise.all([
      fetchAllRows<DailyDeposit>('daily_deposits', '*'),
      fetchAllRows<HistoryRow>('cheque_history', 'id, cheque_id, to_status, changed_by, created_at, reverts_history_id'),
    ])
    if (run !== latest.current) return
    const undone = new Set(history.rows.map((h) => h.reverts_history_id).filter(Boolean))
    const kept = history.rows.filter((h) => !undone.has(h.id))
    setDeposits(funds.rows)
    setEverReturned(new Set(kept.filter((h) => h.to_status === 'RETURNED').map((h) => h.cheque_id)))
    // An import isn't when a cheque passed; the latest passing counts.
    const passed = new Map<string, string>()
    for (const h of kept) {
      if (h.to_status !== 'PASSED' || h.changed_by === 'import') continue
      const day = isoDateOf(h.created_at)
      const known = passed.get(h.cheque_id)
      if (!known || day > known) passed.set(h.cheque_id, day)
    }
    setPassedOn(passed)
    setError(funds.error ?? history.error ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])
  useDataChanges(load)

  return {
    rows: list.rows,
    accounts: list.accounts,
    deposits,
    everReturned,
    passedOn,
    loading: loading || list.loading,
    error: error ?? list.error,
  }
}
