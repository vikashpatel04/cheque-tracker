import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatMoney } from '@/lib/formatters'
import { writeOffCheque } from '@/lib/updateChequeStatus'
import { replacementChequePath } from '@/lib/chequeTags'
import type { Cheque } from '@/types'

interface WriteOffDialogProps {
  cheque: Cheque | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

/**
 * Close a returned cheque that can't be used again (wrong amount, mistake in
 * words, overwriting…). A new cheque can then be issued in its place.
 */
export function WriteOffDialog({ cheque, open, onOpenChange, onSuccess }: WriteOffDialogProps) {
  const navigate = useNavigate()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) setReason('')
  }, [open])

  const handleConfirm = async () => {
    if (!cheque || !reason.trim()) return
    setSubmitting(true)
    const result = await writeOffCheque(cheque.id, reason.trim())
    setSubmitting(false)
    if (!result.success) {
      toast.error(`Couldn't write it off: ${result.error}`)
      return
    }
    toast.success(`Cheque ${cheque.cheque_number} written off`, {
      action: {
        label: 'Issue a new one',
        onClick: () => navigate(replacementChequePath(cheque.id)),
      },
      duration: 10000,
    })
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!submitting) onOpenChange(o) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Write it off</DialogTitle>
          <DialogDescription>
            {cheque && (
              <>
                Cheque <span className="font-cheque">{cheque.cheque_number}</span>
                {cheque.party?.name ? ` to ${cheque.party.name}` : ''}, {formatMoney(Number(cheque.amount))}.{' '}
              </>
            )}
            For a returned cheque that can&apos;t be used again. It&apos;s closed as Written off, and you can issue a new
            cheque in its place.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void handleConfirm()
          }}
        >
          <div className="flex flex-col">
            <Label htmlFor="writeoff-reason">Why</Label>
            <Textarea id="writeoff-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} autoFocus />
            <span className="mt-1 text-[13px] text-ink-quiet">For example, the amount in words doesn&apos;t match.</span>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={!reason.trim() || submitting}>
              {submitting ? 'Saving…' : 'Write it off'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
