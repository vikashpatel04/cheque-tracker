import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useDataChanges } from '@/lib/dataEvents'
import { todayISO } from '@/lib/formatters'
import { getActiveRegion } from '@/lib/region'
import { addSampleData, hasSampleData, removeSampleData } from '@/lib/sampleData'

/**
 * The made-up sample set (src/lib/sampleData.ts): whether it's there, and
 * adding or removing it with a message either way. For Settings → Your data
 * and onboarding.
 */
export function useSampleData() {
  const [present, setPresent] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  const check = useCallback(() => void hasSampleData().then(setPresent), [])
  useEffect(check, [check])
  useDataChanges(check)

  const add = async () => {
    setBusy(true)
    const { error, added } = await addSampleData(todayISO(), getActiveRegion().chequeValidityMonths)
    setBusy(false)
    if (error) toast.error(`Stopped after ${added ?? 0} sample cheques: ${error}`)
    else toast.success(`Added ${added} sample cheques. Have a look at Today and Cheques.`)
    check()
    return !error
  }

  const remove = async () => {
    setBusy(true)
    const { error } = await removeSampleData()
    setBusy(false)
    if (error) toast.error(`Couldn't remove it all: ${error}`)
    else toast.success('Sample data removed')
    check()
    return !error
  }

  return { present, busy, add, remove }
}
