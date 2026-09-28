import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useDataChanges } from '@/lib/dataEvents'
import type { BankAccount } from '@/types/received'

/** Your bank accounts, the default one first. */
export function useBankAccounts() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('bank_accounts')
      .select('*')
      .is('deleted_at', null)
      .order('is_default', { ascending: false })
      .order('name')
    setAccounts((data ?? []) as BankAccount[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])
  useDataChanges(load)

  const defaultAccount = accounts.find((a) => a.is_default) ?? null
  return { accounts, defaultAccount, loading }
}
