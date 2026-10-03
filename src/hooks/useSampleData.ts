import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { usePlan } from '@/hooks/usePlan'
import { useDataChanges } from '@/lib/dataEvents'
import { hasSampleData, removeSampleData } from '@/lib/sampleData'

/**
 * The old sample set (src/lib/sampleData.ts): whether it's still there, and
 * removing it with a message either way. For Settings → Your data.
 */
export function useSampleData() {
  const { requireWrite } = usePlan()
  const [present, setPresent] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  const check = useCallback(() => void hasSampleData().then(setPresent), [])
  useEffect(check, [check])
  useDataChanges(check)

  const remove = async () => {
    if (!requireWrite()) return false
    setBusy(true)
    const { error } = await removeSampleData()
    setBusy(false)
    if (error) toast.error(`Couldn't remove it all: ${error}`)
    else toast.success('Sample data removed')
    check()
    return !error
  }

  return { present, busy, remove }
}
