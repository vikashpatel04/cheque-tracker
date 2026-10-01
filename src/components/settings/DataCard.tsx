import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, FlaskConical, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { SettingRow, SettingsSection } from '@/components/settings/SettingsSection'
import { brand } from '@/config/brand'
import { usePlan } from '@/hooks/usePlan'
import { useSampleData } from '@/hooks/useSampleData'
import { announceDataChange } from '@/lib/dataEvents'
import { exportAllData } from '@/lib/exportUtils'
import { fetchAllRows } from '@/lib/fetchAll'
import { formatNumber } from '@/lib/formatters'
import { readWorkbook, runImport } from '@/lib/importData'
import { planImport, type ImportPlan } from '@/lib/importPlan'
import { getActiveRegion } from '@/lib/region'
import { supabase } from '@/lib/supabase'
import { ALL_STATUSES, STATUS_LABELS, type Cheque, type ChequeHistory, type DailyDeposit, type Party } from '@/types'
import type { BankAccount, ReceivedCheque, ReceivedChequeHistory } from '@/types/received'

/** What to type before everything is deleted. */
const CONFIRM_PHRASE = 'DELETE MY DATA'
/** How many problem rows the import preview lists before summarising the rest. */
const PROBLEMS_SHOWN = 20

const count = (n: number, one: string, many: string) => `${formatNumber(n)} ${n === 1 ? one : many}`

function statusBreakdown(plan: ImportPlan): string {
  return ALL_STATUSES.map((status) => [status, plan.cheques.filter((c) => c.status === status).length] as const)
    .filter(([, n]) => n > 0)
    .map(([status, n]) => `${formatNumber(n)} ${STATUS_LABELS[status]}`)
    .join(', ')
}

async function exportEverything() {
  const results = await Promise.all([
    fetchAllRows<Party>('parties', '*', { activeOnly: true }),
    fetchAllRows<Cheque>('cheques', '*, party:parties(*)', { activeOnly: true }),
    fetchAllRows<ChequeHistory>('cheque_history'),
    fetchAllRows<DailyDeposit>('daily_deposits'),
    fetchAllRows<ReceivedCheque>('received_cheques', '*, party:parties(*)', { activeOnly: true }),
    fetchAllRows<ReceivedChequeHistory>('received_cheque_history'),
    fetchAllRows<BankAccount>('bank_accounts', '*', { activeOnly: true }),
  ])
  const failed = results.find((r) => r.error)
  if (failed) {
    toast.error(`Export failed, nothing was downloaded: ${failed.error}`)
    return
  }
  const [parties, cheques, history, deposits, received, receivedHistory, accounts] = results
  await exportAllData({
    parties: parties.rows as Party[],
    cheques: cheques.rows as Cheque[],
    history: history.rows as ChequeHistory[],
    deposits: deposits.rows as DailyDeposit[],
    received: received.rows as ReceivedCheque[],
    receivedHistory: receivedHistory.rows as ReceivedChequeHistory[],
    accounts: accounts.rows as BankAccount[],
  })
  toast.success('Everything exported')
}

/** Reads an export and previews what it would add; nothing is saved until Import. */
function ImportFromExport() {
  const { guard } = usePlan()
  const navigate = useNavigate()
  const input = useRef<HTMLInputElement>(null)
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
    announceDataChange()
    navigate('/')
  }

  const nothingToImport = !!plan && plan.parties.length + plan.cheques.length + plan.deposits.length === 0

  return (
    <>
      <input ref={input} type="file" accept=".xlsx,.xls" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={handleFile} />
      <Button variant="outline" onClick={guard(() => input.current?.click())}>
        <Upload />
        Import from an export
      </Button>

      <Dialog
        open={!!plan}
        onOpenChange={(open) => {
          if (!open && !importing) setPlan(null)
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="break-all">Import {fileName}</DialogTitle>
            <DialogDescription>Nothing is saved until you choose Import. If anything fails, nothing is saved.</DialogDescription>
          </DialogHeader>

          {plan && (
            <div className="flex flex-col gap-4 text-sm">
              <ul className="flex flex-col gap-1">
                <li>
                  <span className="font-semibold">Parties:</span> {formatNumber(plan.parties.length)}
                  {plan.addedParties.length > 0 && (
                    <span className="text-ink-quiet">
                      , including {formatNumber(plan.addedParties.length)} named on cheques but missing from the Parties sheet
                    </span>
                  )}
                </li>
                <li>
                  <span className="font-semibold">Given cheques:</span> {formatNumber(plan.cheques.length)}
                  {plan.cheques.length > 0 && <span className="text-ink-quiet"> ({statusBreakdown(plan)})</span>}
                </li>
                <li>
                  <span className="font-semibold">Funds added:</span> {formatNumber(plan.deposits.length)}
                </li>
              </ul>
              <p className="text-ink-quiet">Dates are read as {plan.dateFormat.toUpperCase()}.</p>

              {plan.mergedParties.length > 0 && <p>Listed more than once, so each becomes one party: {plan.mergedParties.join(', ')}.</p>}

              {plan.problems.length > 0 && (
                <div>
                  <p className="font-semibold text-problem">{count(plan.problems.length, 'row', 'rows')} will be left out:</p>
                  <ul className="mt-1 flex flex-col gap-0.5 text-xs">
                    {plan.problems.slice(0, PROBLEMS_SHOWN).map((p) => (
                      <li key={`${p.sheet}-${p.row}`}>
                        {p.sheet}, row {p.row}: {p.message}
                      </li>
                    ))}
                    {plan.problems.length > PROBLEMS_SHOWN && (
                      <li className="text-ink-quiet">and {formatNumber(plan.problems.length - PROBLEMS_SHOWN)} more</li>
                    )}
                  </ul>
                </div>
              )}

              {plan.skippedSheets.length > 0 && (
                <div>
                  <p className="font-semibold">Not imported:</p>
                  <ul className="mt-1 flex flex-col gap-1 text-xs">
                    {plan.skippedSheets.map((s) => (
                      <li key={s.sheet}>
                        <span className="font-semibold">{s.sheet}</span> ({count(s.rows, 'row', 'rows')}): {s.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPlan(null)} disabled={importing}>
              Cancel
            </Button>
            <Button onClick={() => void handleImport()} disabled={importing || nothingToImport}>
              {importing ? 'Importing…' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Settings → Your data: export, import, sample data, and deleting everything. */
export function DataCard() {
  const { requireWrite } = usePlan()
  const sample = useSampleData()
  const [exporting, setExporting] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const deleteAll = async () => {
    if (phrase !== CONFIRM_PHRASE) return
    setDeleting(true)
    const now = new Date().toISOString()
    for (const table of ['received_cheques', 'cheques', 'bank_accounts', 'parties'] as const) {
      const { error } = await supabase.from(table).update({ deleted_at: now }).is('deleted_at', null)
      if (error) {
        setDeleting(false)
        toast.error(`Stopped part way: ${error.message}`)
        announceDataChange()
        return
      }
    }
    setDeleting(false)
    setConfirming(false)
    setPhrase('')
    toast.success('All your parties, cheques and bank accounts are deleted')
    announceDataChange()
  }

  return (
    <SettingsSection id="data" title="Your data">
      <div className="flex flex-col gap-2">
        <span className="text-sm text-ink-quiet">
          The export is one Excel file with every party, cheque, history entry, fund added and bank account. Import brings in
          parties, given cheques and funds added from a {brand.name} export, on an account with none yet.
        </span>
        <div className="flex flex-wrap gap-2.5">
          <Button
            variant="outline"
            disabled={exporting}
            onClick={async () => {
              setExporting(true)
              await exportEverything()
              setExporting(false)
            }}
          >
            <Download />
            {exporting ? 'Exporting…' : 'Export everything (Excel)'}
          </Button>
          <ImportFromExport />
        </div>
      </div>

      <div id="sample-data" className="scroll-mt-4 border-t border-line-soft pt-4 lg:scroll-mt-[92px]">
        <SettingRow
          label="Sample data"
          hint="Made-up parties, an account and cheques in every state, to see how things work. Their names end in “(sample)”, and you can remove them all here. Given samples are only added to an account with no given cheques."
        >
          {sample.present ? (
            <Button variant="outline" className="text-problem" disabled={sample.busy} onClick={() => void sample.remove()}>
              <Trash2 />
              {sample.busy ? 'Removing…' : 'Remove sample data'}
            </Button>
          ) : (
            <Button variant="outline" disabled={sample.busy || sample.present === null} onClick={() => void sample.add()}>
              <FlaskConical />
              {sample.busy ? 'Adding…' : 'Try with sample data'}
            </Button>
          )}
        </SettingRow>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-problem-line p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[15px] font-semibold text-problem">Delete all data</span>
          <span className="text-sm text-ink-quiet">Removes every party, cheque and bank account. You'll type a phrase to confirm.</span>
        </div>
        <AlertDialog
          open={confirming}
          onOpenChange={(open) => {
            if (open && !requireWrite()) return
            setConfirming(open)
            if (!open) setPhrase('')
          }}
        >
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="shrink-0 border-problem-line text-problem hover:bg-problem-soft hover:text-problem">
              Delete…
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete all your data?</AlertDialogTitle>
              <AlertDialogDescription>
                Every party, cheque you gave or received, and bank account goes. Export first if you might want it back. Type{' '}
                <strong className="text-ink">{CONFIRM_PHRASE}</strong> to confirm.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder={CONFIRM_PHRASE} aria-label="Confirmation phrase" autoComplete="off" />
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  void deleteAll()
                }}
                disabled={phrase !== CONFIRM_PHRASE || deleting}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {deleting ? 'Deleting…' : 'Delete everything'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SettingsSection>
  )
}
