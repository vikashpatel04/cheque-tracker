import { useState, useEffect } from 'react'
import { addMonths, format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DateInput } from '@/components/ui/date-picker'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { HelpLink } from '@/components/guide/HelpLink'
import { representCheque } from '@/lib/updateChequeStatus'
import { formatMoney, formatShortDate, todayISO } from '@/lib/formatters'
import { getActiveRegion } from '@/lib/region'
import type { Cheque } from '@/types'

interface PresentAgainDialogProps {
  cheque: Cheque | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

/**
 * Present a returned cheque again: the party deposits the same cheque on a
 * new date. It goes back to Pending (or straight to Funded, when the money is
 * already in the bank) and follows the normal life cycle.
 */
export function PresentAgainDialog({ cheque, open, onOpenChange, onSuccess }: PresentAgainDialogProps) {
  const [newDueDate, setNewDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [funded, setFunded] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && cheque) {
      setNewDueDate(todayISO())
      setNotes('')
      setFunded(false)
    }
  }, [open, cheque])

  if (!cheque) return null

  // Banks refuse cheques older than the validity period set for the user's
  // region (counted from the date written on the cheque).
  const { chequeValidityMonths } = getActiveRegion()
  const chequeDate = cheque.original_due_date ?? cheque.due_date
  const validTill = format(addMonths(parseISO(chequeDate), chequeValidityMonths), 'yyyy-MM-dd')
  const pastValidity = !!newDueDate && newDueDate > validTill
  const months = `${chequeValidityMonths} month${chequeValidityMonths === 1 ? '' : 's'}`

  const save = async () => {
    if (!newDueDate) return
    setSubmitting(true)
    const result = await representCheque(cheque.id, newDueDate, {
      note: notes.trim() || undefined,
      markDeposited: funded,
    })
    setSubmitting(false)
    if (!result.success) {
      toast.error(`Couldn't present it again: ${result.error}`)
      return
    }
    toast.success(
      funded
        ? `Cheque ${cheque.cheque_number} presented again and funded`
        : `Cheque ${cheque.cheque_number} presented again, due ${formatShortDate(newDueDate)}`
    )
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Present it again</DialogTitle>
          <DialogDescription>
            Cheque <span className="font-cheque">{cheque.cheque_number}</span>
            {cheque.party?.name ? ` to ${cheque.party.name}` : ''}, {formatMoney(Number(cheque.amount))}. The same cheque goes
            back to Pending with a new date; its return stays in the history.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-xl bg-background px-4 py-3 text-[15px]">
          <dt className="text-ink-quiet">Came back</dt>
          <dd className="text-problem">{cheque.return_reason || 'No reason noted'}</dd>
          <dt className="text-ink-quiet">Cheque date</dt>
          <dd>{formatShortDate(chequeDate)}</dd>
          {cheque.original_due_date && cheque.original_due_date !== cheque.due_date && (
            <>
              <dt className="text-ink-quiet">Last presented</dt>
              <dd>{formatShortDate(cheque.due_date)}</dd>
            </>
          )}
          {cheque.represent_count > 0 && (
            <>
              <dt className="text-ink-quiet">Presented again</dt>
              <dd>
                {cheque.represent_count} time{cheque.represent_count === 1 ? '' : 's'} before
              </dd>
            </>
          )}
        </dl>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <div className="flex flex-col">
            <Label htmlFor="rp-due-date">They&apos;ll deposit it on</Label>
            <DateInput id="rp-due-date" value={newDueDate} onChange={setNewDueDate} />
            {pastValidity ? (
              <span className="mt-1 text-[13px] text-attention">
                That&apos;s after {formatShortDate(validTill)}, more than {months} from the cheque date, so the bank may refuse it as
                stale.
              </span>
            ) : (
              <span className="mt-1 text-[13px] text-ink-quiet">When the party will deposit this cheque again.</span>
            )}
          </div>

          <label className="flex items-start gap-3 text-[15px]">
            <Checkbox checked={funded} onCheckedChange={(v) => setFunded(v === true)} className="mt-0.5" />
            <span>
              The money for it is already in the bank
              <span className="block text-[13px] text-ink-quiet">It&apos;s marked Funded instead of Pending.</span>
            </span>
          </label>

          <div className="flex flex-col">
            <Label htmlFor="rp-notes">
              Note <span className="font-normal text-ink-quiet">(optional)</span>
            </Label>
            <Textarea id="rp-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <HelpLink topic="bounce" className="self-start" />

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!newDueDate || submitting}>
              {submitting ? 'Saving…' : 'Present it again'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
