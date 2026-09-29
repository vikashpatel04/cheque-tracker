import { useCallback, useEffect, useState } from 'react'
import { useDataChanges } from '@/lib/dataEvents'
import { supabase } from '@/lib/supabase'

export interface SetupStatus {
  loading: boolean
  /** Any cheque, given or received. */
  hasCheques: boolean
  hasAccounts: boolean
}

/**
 * What a new account has set up so far, for Today's first-run checklist:
 * counts only, so it stays quick however many cheques there are.
 */
export function useSetupStatus(): SetupStatus {
  const [status, setStatus] = useState<SetupStatus>({ loading: true, hasCheques: false, hasAccounts: false })

  const load = useCallback(async () => {
    const count = (table: 'cheques' | 'received_cheques' | 'bank_accounts') =>
      supabase.from(table).select('id', { count: 'exact', head: true }).is('deleted_at', null)
    const [given, received, accounts] = await Promise.all([count('cheques'), count('received_cheques'), count('bank_accounts')])
    setStatus({
      loading: false,
      hasCheques: (given.count ?? 0) + (received.count ?? 0) > 0,
      hasAccounts: (accounts.count ?? 0) > 0,
    })
  }, [])

  useEffect(() => {
    void load()
  }, [load])
  useDataChanges(load)

  return status
}
