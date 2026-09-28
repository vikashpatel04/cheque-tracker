import { useCallback, useEffect, useRef, useState } from 'react'
import { useDataChanges } from '@/lib/dataEvents'
import { fetchAllRows } from '@/lib/fetchAll'
import { givenRow, receivedRow, type ListRow } from '@/lib/chequeList'
import type { Cheque } from '@/types'
import type { BankAccount, ReceivedCheque } from '@/types/received'

/**
 * Every cheque, both directions, for the Cheques list: fetched page by page
 * so large accounts aren't cut off at 1,000, and refreshed after any save.
 */
export function useChequeListData() {
  const [rows, setRows] = useState<ListRow[]>([])
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const latest = useRef(0)

  const load = useCallback(async () => {
    const run = ++latest.current
    const [given, received, bankAccounts] = await Promise.all([
      fetchAllRows<Cheque>('cheques', '*, party:parties(*)', { activeOnly: true }),
      fetchAllRows<ReceivedCheque>('received_cheques', '*, party:parties(*), deposit_account:bank_accounts(*)', {
        activeOnly: true,
      }),
      fetchAllRows<BankAccount>('bank_accounts', '*', { activeOnly: true }),
    ])
    if (run !== latest.current) return
    setRows([...given.rows.map(givenRow), ...received.rows.map(receivedRow)])
    setAccounts(bankAccounts.rows)
    setError(given.error ?? received.error ?? bankAccounts.error ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])
  useDataChanges(load)

  return { rows, accounts, loading, error, refresh: load }
}
