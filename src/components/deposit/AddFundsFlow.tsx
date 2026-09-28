import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { announceDataChange } from '@/lib/dataEvents'
import { todayISO } from '@/lib/formatters'
import { recordDeposit } from '@/lib/updateChequeStatus'
import { AllocationModal } from './AllocationModal'

interface AddFundsFlowProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Starts the amount at what's needed, e.g. from a to-do. */
  amount?: number
}

/**
 * Add funds: the amount put into the bank today, then which pending cheques it
 * covers. Saving marks those cheques Funded, all at once.
 */
export function AddFundsFlow({ open, onOpenChange, amount: suggested }: AddFundsFlowProps) {
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [allocating, setAllocating] = useState<number | null>(null)

  useEffect(() => {
    if (open && suggested) setAmount(String(suggested))
  }, [open, suggested])

  const confirmAmount = () => {
    const value = parseFloat(amount)
    if (isNaN(value) || value <= 0) return
    onOpenChange(false)
    setAllocating(value)
  }

  const confirmAllocation = async (selectedIds: string[]) => {
    if (allocating === null) return {}
    const result = await recordDeposit(allocating, todayISO(), selectedIds, notes || undefined)
    if (!result.success) return { error: result.error }
    announceDataChange()
    setAmount('')
    setNotes('')
    return {}
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add funds</DialogTitle>
            <DialogDescription>Money you put into the bank today to cover cheques you gave.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              confirmAmount()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="funds-amount">Amount added to the bank today</Label>
              <Input
                id="funds-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="funds-notes">Notes (optional)</Label>
              <Textarea id="funds-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Continue</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {allocating !== null && (
        <AllocationModal
          depositAmount={allocating}
          onClose={() => setAllocating(null)}
          onConfirm={confirmAllocation}
        />
      )}
    </>
  )
}
