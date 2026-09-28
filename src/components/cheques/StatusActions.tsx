import { useState, type ComponentType } from 'react'
import { Ban, CheckCheck, CheckCircle2, Clock, FileX, RotateCcw, Wallet } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import { updateChequeStatus } from '@/lib/updateChequeStatus'
import { STATUS_LABELS, VALID_STATUS_TRANSITIONS } from '@/types'
import type { Cheque, ChequeStatus } from '@/types'
import { toast } from 'sonner'

interface StatusMeta {
  label: string
  Icon: ComponentType<{ className?: string }>
  /** Extra classes for the button/menu-item variant of this action. */
  tone?: string
}

export const STATUS_ACTION_META: Record<ChequeStatus, StatusMeta> = {
  PENDING: { label: 'Pending', Icon: Clock },
  DEPOSITED: { label: 'Funded', Icon: Wallet },
  PASSED: { label: 'Passed', Icon: CheckCircle2 },
  RETURNED: {
    label: 'Returned',
    Icon: RotateCcw,
    tone: 'text-destructive focus:text-destructive hover:text-destructive',
  },
  CANCELLED: { label: 'Cancelled', Icon: Ban, tone: 'text-muted-foreground' },
  WRITTEN_OFF: { label: 'Written off', Icon: FileX, tone: 'text-muted-foreground' },
}

/**
 * A PENDING cheque cannot reach PASSED in one hop — it must go through
 * DEPOSITED (funded). This reports whether the "Funded & Passed" shortcut (which just
 * runs both existing transitions back to back) applies to the given status.
 */
export function canChainDepositedAndPassed(status: ChequeStatus): boolean {
  return (
    VALID_STATUS_TRANSITIONS[status].includes('DEPOSITED') &&
    VALID_STATUS_TRANSITIONS['DEPOSITED'].includes('PASSED')
  )
}

/**
 * Shared cheque status-change behaviour: runs one or more transitions through
 * the existing updateChequeStatus(), captures a return reason when needed, and
 * surfaces a dialog the caller renders. Used by both the list row menu and the
 * detail sheet so every surface behaves identically.
 */
export function useChequeStatusActions(onChanged: () => void) {
  const [pending, setPending] = useState<Cheque | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const run = async (cheque: Cheque, chain: ChequeStatus[], returnReason?: string) => {
    setSubmitting(true)
    for (const status of chain) {
      const result = await updateChequeStatus(cheque.id, status, {
        changedBy: 'manual',
        returnReason: status === 'RETURNED' ? returnReason : undefined,
      })
      if (!result.success) {
        setSubmitting(false)
        toast.error(result.error ?? 'Failed to update status')
        return
      }
    }
    setSubmitting(false)
    setPending(null)
    setReason('')
    toast.success(
      chain.length > 1
        ? `Marked ${chain.map((s) => STATUS_ACTION_META[s].label).join(' & ')}`
        : `Status updated to ${STATUS_LABELS[chain[0]]}`
    )
    onChanged()
  }

  /** Single transition. RETURNED first prompts for a reason. */
  const requestStatus = (cheque: Cheque, status: ChequeStatus) => {
    if (status === 'RETURNED') {
      setReason('')
      setPending(cheque)
      return
    }
    void run(cheque, [status])
  }

  /** Shortcut: DEPOSITED then PASSED, both recorded in history. */
  const requestChained = (cheque: Cheque) => {
    void run(cheque, ['DEPOSITED', 'PASSED'])
  }

  const returnDialog = (
    <Dialog
      open={!!pending}
      onOpenChange={(o) => {
        if (submitting) return
        if (!o) { setPending(null); setReason('') }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark cheque as Returned</DialogTitle>
          <DialogDescription>
            Add a reason — this is stored with the cheque and shown in its history.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="status-return-reason">Return reason</Label>
          <Textarea
            id="status-return-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Insufficient funds, signature mismatch..."
            rows={3}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => { setPending(null); setReason('') }}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              const trimmed = reason.trim()
              if (!trimmed || !pending) return
              void run(pending, ['RETURNED'], trimmed)
            }}
            disabled={!reason.trim() || submitting}
          >
            {submitting ? 'Saving...' : 'Mark Returned'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return { requestStatus, requestChained, submitting, returnDialog }
}

interface ChequeStatusActionsProps {
  cheque: Cheque
  onChanged: () => void
  className?: string
}

/**
 * Button-group presentation of the available status transitions, plus the
 * "Funded & Passed" shortcut. Self-contained — renders its own return dialog.
 */
export function ChequeStatusActions({ cheque, onChanged, className }: ChequeStatusActionsProps) {
  const { requestStatus, requestChained, submitting, returnDialog } = useChequeStatusActions(onChanged)
  const transitions = VALID_STATUS_TRANSITIONS[cheque.status]

  if (transitions.length === 0) return null

  return (
    <div className={cn('rounded-lg border bg-muted/30 p-3', className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Update status
      </p>
      <div className="flex flex-wrap gap-2">
        {transitions.map((s) => {
          const { label, Icon, tone } = STATUS_ACTION_META[s]
          return (
            <Button
              key={s}
              size="sm"
              variant="outline"
              disabled={submitting}
              onClick={() => requestStatus(cheque, s)}
              className={tone}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          )
        })}
      </div>
      {canChainDepositedAndPassed(cheque.status) && (
        <>
          <div className="flex items-center gap-2 my-2.5">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">or in one step</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button
            size="sm"
            className="w-full"
            disabled={submitting}
            onClick={() => requestChained(cheque)}
          >
            <CheckCheck className="h-4 w-4" />
            Mark {STATUS_ACTION_META.DEPOSITED.label} &amp; {STATUS_ACTION_META.PASSED.label}
          </Button>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Records both steps ({STATUS_ACTION_META.DEPOSITED.label} → {STATUS_ACTION_META.PASSED.label}) in history.
          </p>
        </>
      )}
      {returnDialog}
    </div>
  )
}
