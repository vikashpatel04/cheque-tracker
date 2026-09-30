import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ExcelFileChooser } from '@/components/shared/ExcelFileChooser'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { describeExisting, useExistingChequeNumbers } from '@/hooks/useExistingChequeNumbers'
import { useParties } from '@/hooks/useParties'
import { accountLabel } from '@/lib/bankAccounts'
import { inChequeBook } from '@/lib/chequeNumbers'
import { columnValue, downloadChequeTemplate, parseExcelFile } from '@/lib/exportUtils'
import { formatMoney, formatShortDate, parseAmount, parseFlexibleDate, toISODate } from '@/lib/formatters'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface BulkUploadProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

interface PreviewRow {
  party_name: string
  cheque_number: string
  bank_name: string
  amount: number
  issue_date: string
  due_date: string
  notes: string
  party_id?: string
  error?: string
}

/** The "From your account" choice that keeps each row's own bank, with no account. */
const FILE_BANKS = '__file_banks__'

const plural = (n: number) => `${n} cheque${n === 1 ? '' : 's'}`

/**
 * Import given cheques from the Excel template. Every row is shown before
 * anything is saved, and the good rows are saved together or not at all.
 * They're drawn on the account you choose (your default at first), or keep
 * the bank in each row.
 */
export function ChequeBulkUpload({ open, onOpenChange, onComplete }: BulkUploadProps) {
  const { parties } = useParties()
  const { accounts, defaultAccount } = useBankAccounts()
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [step, setStep] = useState<'upload' | 'preview'>('upload')
  const [account, setAccount] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const accountChoice = account ?? defaultAccount?.id ?? FILE_BANKS
  const chosen = accounts.find((a) => a.id === accountChoice) ?? null

  // A row needs a bank of its own only when the cheques keep the file's banks.
  const preview = useMemo(
    () => rows.map((r) => (!r.error && !chosen && !r.bank_name ? { ...r, error: 'No bank name' } : r)),
    [rows, chosen]
  )
  const ready = preview.filter((r) => !r.error && r.party_id)
  const skipped = preview.length - ready.length
  const existingNumbers = useExistingChequeNumbers(preview.map((r) => r.cheque_number))

  const startOver = () => {
    setStep('upload')
    setRows([])
  }

  const handleFile = async (file: File) => {
    let sheet: Awaited<ReturnType<typeof parseExcelFile>>
    try {
      sheet = await parseExcelFile(file)
    } catch {
      toast.error("Couldn't read that file. Choose an Excel file filled in like the template.")
      return
    }
    const partyMap = new Map(parties.map((p) => [p.name.toLowerCase(), p.id]))
    setRows(
      sheet.map((row) => {
        const party_name = String(row['Party Name'] ?? '').trim()
        const cheque_number = String(row['Cheque Number'] ?? '').trim()
        const bank_name = String(row['Bank Name'] ?? '').trim()
        const rawAmount = row['Amount']
        const amount = typeof rawAmount === 'number' ? rawAmount : parseAmount(String(rawAmount ?? ''))
        // Date headers include the format ("Due Date (DD/MM/YYYY)"), which varies
        // by region and between template versions, so match on the start only.
        const issueDate = parseFlexibleDate(columnValue(row, 'Issue Date'))
        const dueDate = parseFlexibleDate(columnValue(row, 'Due Date'))
        const party_id = partyMap.get(party_name.toLowerCase())

        const error = !party_name
          ? 'No party name'
          : !party_id
            ? 'Not one of your parties'
            : !cheque_number
              ? 'No cheque number'
              : !amount || amount <= 0
                ? 'No amount'
                : !issueDate
                  ? "The issue date isn't a date"
                  : !dueDate
                    ? "The due date isn't a date"
                    : undefined

        return {
          party_name,
          cheque_number,
          bank_name,
          amount,
          issue_date: issueDate ? toISODate(issueDate) : '',
          due_date: dueDate ? toISODate(dueDate) : '',
          notes: String(row['Notes'] ?? '').trim(),
          party_id,
          error,
        }
      })
    )
    setStep('preview')
  }

  const handleConfirm = async () => {
    if (ready.length === 0) return
    setSubmitting(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSubmitting(false)
      toast.error("You're signed out. Sign in again, then import.")
      return
    }
    // One request for all rows: the import either fully succeeds or saves
    // nothing, so it can be retried without creating duplicates.
    const { error } = await supabase.from('cheques').insert(
      ready.map((row) => ({
        user_id: user.id,
        status: 'PENDING',
        party_id: row.party_id!,
        cheque_number: row.cheque_number,
        bank_name: chosen ? chosen.bank_name : row.bank_name,
        bank_account_id: chosen?.id ?? null,
        amount: row.amount,
        issue_date: row.issue_date,
        due_date: row.due_date,
        notes: row.notes || null,
      }))
    )
    setSubmitting(false)
    if (error) {
      toast.error(`Nothing was imported: ${error.message}`)
      return
    }
    toast.success(`Imported ${plural(ready.length)}`)
    startOver()
    onComplete()
    onOpenChange(false)
  }

  /** Worth a look, but still imported: a number already used, or another bank in the file. */
  const warningFor = (row: PreviewRow) => {
    const used = describeExisting(
      existingNumbers.get(row.cheque_number)?.filter((c) => inChequeBook(c, chosen?.id ?? null, defaultAccount?.id ?? null))
    )
    if (used) return used
    if (chosen && row.bank_name && row.bank_name.toLowerCase() !== chosen.bank_name.toLowerCase()) {
      return `The file says ${row.bank_name}; it's saved on ${accountLabel(chosen)}`
    }
    return null
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (submitting) return
        if (!o) startOver()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import given cheques from Excel</DialogTitle>
          <DialogDescription>
            {step === 'upload'
              ? "Fill in the template, then choose the file. You'll see every row before anything is saved."
              : 'Check the rows. Only the ready ones are imported.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col items-start gap-1.5">
              <span className="text-[15px] font-semibold">1. Get the template</span>
              <Button variant="outline" onClick={() => downloadChequeTemplate(chosen?.bank_name ?? defaultAccount?.bank_name)}>
                <Download />
                Download the template
              </Button>
              <span className="text-[13px] text-ink-quiet">One cheque per row. Party names must match your parties.</span>
            </div>

            {accounts.length > 0 && (
              <div className="flex flex-col">
                <Label htmlFor="import-account" className="text-[15px] font-semibold">
                  2. From your account
                </Label>
                <Select value={accountChoice} onValueChange={setAccount}>
                  <SelectTrigger id="import-account" className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {accountLabel(a)} · {a.bank_name}
                      </SelectItem>
                    ))}
                    <SelectItem value={FILE_BANKS}>The bank in each row</SelectItem>
                  </SelectContent>
                </Select>
                <span className="mt-1 text-[13px] text-ink-quiet">The cheques in the file are drawn on it.</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <span className="text-[15px] font-semibold">{accounts.length > 0 ? 3 : 2}. Choose the file</span>
              <ExcelFileChooser id="cheque-import-file" onFile={(file) => void handleFile(file)} />
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-col gap-3">
            <p className="text-[15px]">
              <span className="font-semibold">{ready.length} ready</span>
              {skipped > 0 && (
                <>
                  {' '}
                  · <span className="font-semibold text-problem">{skipped} will be skipped</span>
                </>
              )}
              <span className="text-ink-quiet"> · {chosen ? `from ${accountLabel(chosen)}` : 'with the bank in each row'}</span>
            </p>
            <ul className="flex flex-col divide-y rounded-xl border sm:max-h-[50vh] sm:overflow-y-auto">
              {preview.map((row, i) => {
                const warning = row.error ? null : warningFor(row)
                return (
                  <li key={i} className="flex items-start justify-between gap-3 px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{row.party_name || 'No party name'}</p>
                      <p className="text-[13px] text-ink-quiet">
                        <span className="font-cheque">{row.cheque_number || 'No number'}</span>
                        {row.due_date && ` · due ${formatShortDate(row.due_date)}`}
                      </p>
                      <p className={cn('text-[13px]', row.error ? 'text-problem' : warning ? 'text-attention' : 'text-ink-quiet')}>
                        {row.error ?? warning ?? 'Ready to import'}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">{row.amount > 0 ? formatMoney(row.amount) : ''}</span>
                  </li>
                )
              })}
            </ul>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={startOver} disabled={submitting}>
                Choose another file
              </Button>
              <Button onClick={() => void handleConfirm()} disabled={submitting || ready.length === 0}>
                {submitting ? 'Importing…' : `Import ${plural(ready.length)}`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
