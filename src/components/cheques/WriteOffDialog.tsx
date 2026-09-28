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
      toast.error(`Failed to write off: ${result.error}`)
      return
    }
    toast.success(`Cheque #${cheque.cheque_number} written off`, {
      action: {
        label: 'Issue new cheque',
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
          <DialogTitle>Write off cheque {cheque ? `#${cheque.cheque_number}` : ''}</DialogTitle>
          <DialogDescription>
            Use this when the returned cheque can't be used again. It will be closed as{' '}
            <span className="font-medium">Written off</span>. You can then issue a new cheque in its place.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="writeoff-reason">Reason *</Label>
          <Textarea
            id="writeoff-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Amount in words doesn't match, overwriting on date, signature mismatch..."
            rows={3}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!reason.trim() || submitting}>
            {submitting ? 'Saving...' : 'Write Off'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
