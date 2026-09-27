import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { brand } from '@/config/brand'
import { formatNumber } from '@/lib/formatters'
import { getActiveRegion } from '@/lib/region'
import { readWorkbook, runImport } from '@/lib/importData'
import { planImport, type ImportPlan } from '@/lib/importPlan'
import { ALL_STATUSES, STATUS_LABELS } from '@/types'

/** How many problem rows the preview lists before summarising the rest. */
const PROBLEMS_SHOWN = 20

const count = (n: number, one: string, many: string) => `${formatNumber(n)} ${n === 1 ? one : many}`

function statusBreakdown(plan: ImportPlan): string {
  return ALL_STATUSES.map((status) => [status, plan.cheques.filter((c) => c.status === status).length] as const)
    .filter(([, n]) => n > 0)
    .map(([status, n]) => `${formatNumber(n)} ${STATUS_LABELS[status]}`)
    .join(', ')
}

/** Settings → Import: bring in an export from Settings → Export, with a preview first. */
export function ImportCard() {
  const navigate = useNavigate()
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Clear the input so choosing the same file again reopens the preview.
    e.target.value = ''
    if (!file) return
    try {
      setPlan(planImport(await readWorkbook(file), getActiveRegion()))
      setFileName(file.name)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const handleImport = async () => {
    if (!plan) return
    setImporting(true)
    const { counts, error } = await runImport(plan)
    setImporting(false)
    if (!counts) {
      toast.error(`Import failed, nothing was saved: ${error}`)
      return
    }
    const alreadyThere = plan.deposits.length - counts.deposits
    toast.success(
      `Imported ${count(counts.parties, 'party', 'parties')}, ${count(counts.cheques, 'given cheque', 'given cheques')} ` +
        `and ${formatNumber(counts.deposits)} funds added.` +
        (alreadyThere > 0 ? ` ${formatNumber(alreadyThere)} of the funds added were already there.` : '')
    )
    setPlan(null)
    navigate('/')
  }

  const nothingToImport = !!plan && plan.parties.length + plan.cheques.length + plan.deposits.length === 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import</CardTitle>
        <CardDescription>
          Bring in parties, given cheques and funds added from a {brand.name} export. Works on an account with no
          parties or cheques yet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid w-full max-w-sm items-center gap-2">
          <Label htmlFor="import-file">Export file (.xlsx)</Label>
          <Input id="import-file" type="file" accept=".xlsx,.xls" onChange={handleFile} />
        </div>
      </CardContent>

      <Dialog open={!!plan} onOpenChange={(open) => { if (!open && !importing) setPlan(null) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="break-all">Import {fileName}</DialogTitle>
            <DialogDescription>Nothing is saved until you choose Import. If anything fails, nothing is saved.</DialogDescription>
          </DialogHeader>

          {plan && (
            <div className="space-y-4 text-sm">
              <ul className="space-y-1">
                <li>
                  <span className="font-medium">Parties:</span> {formatNumber(plan.parties.length)}
                  {plan.addedParties.length > 0 && (
                    <span className="text-muted-foreground">
                      , including {formatNumber(plan.addedParties.length)} named on cheques but missing from the Parties sheet
                    </span>
                  )}
                </li>
                <li>
                  <span className="font-medium">Given cheques:</span> {formatNumber(plan.cheques.length)}
                  {plan.cheques.length > 0 && <span className="text-muted-foreground"> ({statusBreakdown(plan)})</span>}
                </li>
                <li>
                  <span className="font-medium">Funds added:</span> {formatNumber(plan.deposits.length)}
                </li>
              </ul>
              <p className="text-muted-foreground">Dates are read as {plan.dateFormat.toUpperCase()}.</p>

              {plan.mergedParties.length > 0 && (
                <p>
                  Listed more than once, so each becomes one party: {plan.mergedParties.join(', ')}.
                </p>
              )}

              {plan.problems.length > 0 && (
                <div>
                  <p className="font-medium text-destructive">
                    {count(plan.problems.length, 'row', 'rows')} will be left out:
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {plan.problems.slice(0, PROBLEMS_SHOWN).map((p) => (
                      <li key={`${p.sheet}-${p.row}`}>
                        {p.sheet}, row {p.row}: {p.message}
                      </li>
                    ))}
                    {plan.problems.length > PROBLEMS_SHOWN && (
                      <li className="text-muted-foreground">and {formatNumber(plan.problems.length - PROBLEMS_SHOWN)} more</li>
                    )}
                  </ul>
                </div>
              )}

              {plan.skippedSheets.length > 0 && (
                <div>
                  <p className="font-medium">Not imported:</p>
                  <ul className="mt-1 space-y-1 text-xs">
                    {plan.skippedSheets.map((s) => (
                      <li key={s.sheet}>
                        <span className="font-medium">{s.sheet}</span> ({count(s.rows, 'row', 'rows')}): {s.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPlan(null)} disabled={importing}>Cancel</Button>
            <Button onClick={handleImport} disabled={importing || nothingToImport}>
              {importing ? 'Importing…' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
