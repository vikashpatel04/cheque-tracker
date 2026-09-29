import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadPartyTemplate, parseExcelFile } from '@/lib/exportUtils'
import { useParties } from '@/hooks/useParties'
import { findPreset } from '@/config/regions'
import { getActiveRegion } from '@/lib/region'
import { toast } from 'sonner'

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

export function PartyBulkUpload({ open, onOpenChange, onComplete }: BulkUploadProps) {
  const { parties, createParty } = useParties(true)
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [step, setStep] = useState<'upload' | 'preview'>('upload')
  const [submitting, setSubmitting] = useState(false)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const rows = await parseExcelFile(file)
    const existingNames = new Set(parties.map((p) => p.name.toLowerCase()))
    const seen = new Set<string>()

    const previewRows: PreviewRow[] = rows.map((row) => {
      const name = String(row['Party Name'] ?? '').trim()
      const contact_name = String(row['Contact Name'] ?? '').trim()
      const phone = String(row['Phone'] ?? '').trim()
      const bank_name = String(row['Bank Name'] ?? '').trim()
      const notes = String(row['Notes'] ?? '').trim()

      let error: string | undefined
      if (!name) error = 'Missing party name'
      else if (existingNames.has(name.toLowerCase())) error = 'Duplicate party name'
      else if (seen.has(name.toLowerCase())) error = 'Duplicate in upload'
      else seen.add(name.toLowerCase())

      return { name, contact_name, phone, bank_name, notes, error }
    })

    setPreview(previewRows)
    setStep('preview')
  }

  const handleConfirm = async () => {
    setSubmitting(true)
    const valid = preview.filter((r) => !r.error)
    let inserted = 0
    const failed: string[] = []
    for (const row of valid) {
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
    if (inserted > 0) toast.success(`${inserted} parties imported`)
    if (failed.length > 0) {
      toast.error(`${failed.length} parties failed to import: ${failed.join(', ')}`)
    }
    setSubmitting(false)
    setStep('upload')
    setPreview([])
    onComplete()
    onOpenChange(false)
  }

  const errorCount = preview.filter((r) => r.error).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload Parties</DialogTitle>
        </DialogHeader>

        {step === 'upload' ? (
          <div className="space-y-4">
            <Button variant="outline" onClick={() => downloadPartyTemplate(findPreset(getActiveRegion().country)?.banks[0])}>Download Template</Button>
            <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="party-bulk-file">Excel file</Label>
              <Input
                id="party-bulk-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFile}
              />
            </div>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="p-2">Name</TableHead>
                  <TableHead className="p-2">Contact</TableHead>
                  <TableHead className="p-2">Phone</TableHead>
                  <TableHead className="p-2">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((row, i) => (
                  <TableRow key={i} className={row.error ? 'bg-red-50 dark:bg-red-950/30' : undefined}>
                    <TableCell className="p-2">{row.name || '—'}</TableCell>
                    <TableCell className="p-2">{row.contact_name || '—'}</TableCell>
                    <TableCell className="p-2">{row.phone || '—'}</TableCell>
                    <TableCell className="p-2 text-destructive text-xs">{row.error ?? 'Valid'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {errorCount > 0 && (
              <p className="text-sm text-destructive">{errorCount} row(s) will be skipped</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
              <Button onClick={handleConfirm} disabled={submitting}>
                Import {preview.filter((r) => !r.error).length} Parties
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
