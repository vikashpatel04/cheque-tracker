import { useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ExcelFileChooser } from '@/components/shared/ExcelFileChooser'
import { useParties } from '@/hooks/useParties'
import { downloadPartyTemplate, parseExcelFile } from '@/lib/exportUtils'
import { findPreset } from '@/config/regions'
import { getActiveRegion } from '@/lib/region'
import { cn } from '@/lib/utils'

interface BulkUploadProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

interface PreviewRow {
  name: string
  contact_name: string
  phone: string
  bank_name: string
  notes: string
  error?: string
}

const plural = (n: number) => `${n} ${n === 1 ? 'party' : 'parties'}`

/** Import parties from the Excel template, showing every row before anything is saved. */
export function PartyBulkUpload({ open, onOpenChange, onComplete }: BulkUploadProps) {
  const { parties, createParty } = useParties(true)
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [step, setStep] = useState<'upload' | 'preview'>('upload')
  const [submitting, setSubmitting] = useState(false)

  const ready = preview.filter((r) => !r.error)
  const skipped = preview.length - ready.length

  const startOver = () => {
    setStep('upload')
    setPreview([])
  }

  const handleFile = async (file: File) => {
    let sheet: Awaited<ReturnType<typeof parseExcelFile>>
    try {
      sheet = await parseExcelFile(file)
    } catch {
      toast.error("Couldn't read that file. Choose an Excel file filled in like the template.")
      return
    }
    const existingNames = new Set(parties.map((p) => p.name.toLowerCase()))
    const seen = new Set<string>()

    setPreview(
      sheet.map((row) => {
        const name = String(row['Party Name'] ?? '').trim()
        const key = name.toLowerCase()
        const error = !name ? 'No name' : existingNames.has(key) ? 'Already in your parties' : seen.has(key) ? 'Twice in this file' : undefined
        seen.add(key)
        return {
          name,
          contact_name: String(row['Contact Name'] ?? '').trim(),
          phone: String(row['Phone'] ?? '').trim(),
          bank_name: String(row['Bank Name'] ?? '').trim(),
          notes: String(row['Notes'] ?? '').trim(),
          error,
        }
      })
    )
    setStep('preview')
  }

  const handleConfirm = async () => {
    setSubmitting(true)
    let inserted = 0
    const failed: string[] = []
    for (const row of ready) {
      const result = await createParty({
        name: row.name,
        contact_name: row.contact_name || null,
        phone: row.phone || null,
        bank_name: row.bank_name || null,
        notes: row.notes || null,
        is_active: true,
      })
      if (result.error) failed.push(row.name)
      else inserted++
    }
    if (inserted > 0) toast.success(`Imported ${plural(inserted)}`)
    if (failed.length > 0) toast.error(`Couldn't import ${plural(failed.length)}: ${failed.join(', ')}`)
    setSubmitting(false)
    startOver()
    onComplete()
    onOpenChange(false)
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
          <DialogTitle>Import parties from Excel</DialogTitle>
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
              <Button variant="outline" onClick={() => downloadPartyTemplate(findPreset(getActiveRegion().country)?.banks[0])}>
                <Download />
                Download the template
              </Button>
              <span className="text-[13px] text-ink-quiet">One party per row. Only the name is needed.</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[15px] font-semibold">2. Choose the file</span>
              <ExcelFileChooser id="party-import-file" onFile={(file) => void handleFile(file)} />
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
            </p>
            <ul className="flex flex-col divide-y rounded-xl border sm:max-h-[50vh] sm:overflow-y-auto">
              {preview.map((row, i) => (
                <li key={i} className="flex flex-col px-3.5 py-2.5">
                  <p className="truncate font-semibold">{row.name || 'No name'}</p>
                  {(row.contact_name || row.phone) && (
                    <p className="text-[13px] text-ink-quiet">{[row.contact_name, row.phone].filter(Boolean).join(' · ')}</p>
                  )}
                  <p className={cn('text-[13px]', row.error ? 'text-problem' : 'text-ink-quiet')}>{row.error ?? 'Ready to import'}</p>
                </li>
              ))}
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
