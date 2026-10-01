import { useState, type ComponentType } from 'react'
import { Ban, CheckCircle2, Clock, FileX, RotateCcw, Wallet } from 'lucide-react'
import { toast } from 'sonner'
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
import { HelpLink } from '@/components/guide/HelpLink'
import { usePlan } from '@/hooks/usePlan'
import { formatMoney } from '@/lib/formatters'
import { RETURN_REASONS } from '@/lib/returnReasons'
import { updateChequeStatus } from '@/lib/updateChequeStatus'
import { VALID_STATUS_TRANSITIONS } from '@/types'
import type { Cheque, ChequeStatus } from '@/types'

interface StatusMeta {
  label: string
  Icon: ComponentType<{ className?: string }>
}

export const STATUS_ACTION_META: Record<ChequeStatus, StatusMeta> = {
  PENDING: { label: 'Pending', Icon: Clock },
  DEPOSITED: { label: 'Funded', Icon: Wallet },
  PASSED: { label: 'Passed', Icon: CheckCircle2 },
  RETURNED: { label: 'Returned', Icon: RotateCcw },
  CANCELLED: { label: 'Cancelled', Icon: Ban },
  WRITTEN_OFF: { label: 'Written off', Icon: FileX },
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
 * updateChequeStatus(), asks why when a cheque came back unpaid, and gives the
 * caller that dialog to render. Used by the list rows and the detail, so both
 * behave the same.
 */
export function useChequeStatusActions(onChanged: () => void) {
  const { guard } = usePlan()
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
    toast.success(`Marked ${chain.map((s) => STATUS_ACTION_META[s].label.toLowerCase()).join(' and ')}`)
    onChanged()
  }

  /** Single transition. RETURNED first prompts for a reason. */
  const requestStatus = guard((cheque: Cheque, status: ChequeStatus) => {
    if (status === 'RETURNED') {
      setReason('')
      setPending(cheque)
      return
    }
    void run(cheque, [status])
  })

  /** Shortcut: DEPOSITED then PASSED, both recorded in history. */
  const requestChained = guard((cheque: Cheque) => {
    void run(cheque, ['DEPOSITED', 'PASSED'])
  })

  const close = () => {
    setPending(null)
    setReason('')
  }

  const confirmReturned = () => {
    const trimmed = reason.trim()
    if (trimmed && pending) void run(pending, ['RETURNED'], trimmed)
  }

  const returnDialog = (
    <Dialog open={!!pending} onOpenChange={(open) => !open && !submitting && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>It came back unpaid</DialogTitle>
          <DialogDescription>
            {pending && (
              <>
                Cheque <span className="font-cheque">{pending.cheque_number}</span>
                {pending.party?.name ? ` to ${pending.party.name}` : ''}, {formatMoney(Number(pending.amount))}.{' '}
              </>
            )}
            It&apos;s marked Returned, with the reason in its history. Then present it again or write it off.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            confirmReturned()
          }}
        >
          <div className="flex flex-col">
            <Label htmlFor="status-return-reason">Why</Label>
            <Input
              id="status-return-reason"
              list="status-return-reasons"
              autoComplete="off"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
            <datalist id="status-return-reasons">
              {RETURN_REASONS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
            <span className="mt-1 text-[13px] text-ink-quiet">The reason the bank gave.</span>
          </div>
          <HelpLink topic="bounce" className="self-start" />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={close} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!reason.trim() || submitting}>
              {submitting ? 'Saving…' : 'Mark returned'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )

  return { requestStatus, requestChained, submitting, returnDialog }
}
