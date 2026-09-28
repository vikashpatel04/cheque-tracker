import { useEffect, useState } from 'react'
import { FlaskConical, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useDataChanges } from '@/lib/dataEvents'
import { todayISO } from '@/lib/formatters'
import { getActiveRegion } from '@/lib/region'
import { addSampleData, hasSampleData, removeSampleData } from '@/lib/sampleData'

/** Settings → Sample data: try the app with made-up cheques, then remove them in one go. */
export function SampleDataCard() {
  const [present, setPresent] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  const check = () => void hasSampleData().then(setPresent)
  useEffect(check, [])
  useDataChanges(check)

  const add = async () => {
    setBusy(true)
    const { error, added } = await addSampleData(todayISO(), getActiveRegion().chequeValidityMonths)
    setBusy(false)
    if (error) toast.error(`Stopped after ${added ?? 0} sample cheques: ${error}`)
    else toast.success(`Added ${added} sample cheques. Have a look at Today and Cheques.`)
    check()
  }

  const remove = async () => {
    setBusy(true)
    const { error } = await removeSampleData()
    setBusy(false)
    if (error) toast.error(`Couldn't remove it all: ${error}`)
    else toast.success('Sample data removed')
    check()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sample data</CardTitle>
        <CardDescription>
          Made-up parties, an account and cheques in every state, to see how the app works. Their names end in
          “(sample)”, and you can remove them all here. Given samples are only added to an account with no given cheques.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {!present && (
          <Button variant="outline" disabled={busy || present === null} onClick={() => void add()}>
            <FlaskConical />
            {busy ? 'Adding…' : 'Try with sample data'}
          </Button>
        )}
        {present && (
          <Button variant="destructive" disabled={busy} onClick={() => void remove()}>
            <Trash2 />
            {busy ? 'Removing…' : 'Remove sample data'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
