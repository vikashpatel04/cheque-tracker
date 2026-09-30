import { useEffect, useState } from 'react'
import type { NumberedCheque } from '@/lib/chequeNumbers'
import { supabase } from '@/lib/supabase'
import type { ChequeStatus } from '@/types'

export interface ExistingCheque {
  id: string
  cheque_number: string
  bank_name: string
  bank_account_id: string | null
  status: ChequeStatus
  party_name: string
}

/**
 * Look up live cheques that already use any of the given numbers, so forms can
 * warn about likely duplicate entry. Numbers can legitimately repeat (a
 * re-presented cheque reuses its number), so this is advisory only.
 *
 * Returns a map of cheque_number -> existing cheques (excluding `excludeId`).
 */
export function useExistingChequeNumbers(numbers: string[], excludeId?: string) {
  const [existing, setExisting] = useState<Map<string, ExistingCheque[]>>(new Map())
  const key = [...new Set(numbers.map((n) => n.trim()).filter(Boolean))].sort().join('|')

  useEffect(() => {
    const wanted = key ? key.split('|') : []
    if (wanted.length === 0) {
      setExisting(new Map())
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('cheques')
        .select('id, cheque_number, bank_name, bank_account_id, status, party:parties(name)')
        .in('cheque_number', wanted)
        .is('deleted_at', null)
      if (cancelled || !data) return
      const map = new Map<string, ExistingCheque[]>()
      for (const row of data as unknown as (Omit<ExistingCheque, 'party_name'> & { party: { name: string } | null })[]) {
        if (row.id === excludeId) continue
        const list = map.get(row.cheque_number) ?? []
        list.push({ ...row, party_name: row.party?.name ?? 'Unknown party' })
        map.set(row.cheque_number, list)
      }
      setExisting(map)
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [key, excludeId])

  return existing
}

/**
 * Your latest given cheques' numbers, for suggesting the next one from an
 * account's cheque book (`suggestChequeNumber`). The latest 500 by issue date
 * cover the recent leaves of every book.
 */
export async function loadRecentChequeNumbers(): Promise<NumberedCheque[]> {
  const { data } = await supabase
    .from('cheques')
    .select('cheque_number, issue_date, created_at, bank_account_id')
    .is('deleted_at', null)
    .order('issue_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500)
  return data ?? []
}

export function describeExisting(list: ExistingCheque[] | undefined): string | null {
  if (!list?.length) return null
  const first = list[0]
  const more = list.length > 1 ? ` (+${list.length - 1} more)` : ''
  return `Already used: ${first.party_name}, ${first.bank_name}, ${first.status.toLowerCase()}${more}`
}
