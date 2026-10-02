import { useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { supabase } from '@/lib/supabase'
import { rollbackChequeStatus } from '@/lib/updateChequeStatus'
import { formatDateTime } from '@/lib/formatters'
import { isLegacyRepresented } from '@/lib/chequeTags'
import { STATUS_LABELS, type Cheque, type ChequeHistory, type ChequeStatus } from '@/types'

/**
 * The change a rollback would undo: the latest history row that is not itself
 * a rollback and hasn't been undone yet. An import has nothing before it to go
 * back to. Mirrors rollback_cheque_status().
 */
export function findUndoableChange(history: ChequeHistory[]): ChequeHistory | null {
  const undone = new Set(history.map((h) => h.reverts_history_id).filter(Boolean))
  const candidates = history
    .filter((h) => !h.reverts_history_id && !undone.has(h.id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  const latest = candidates[0]
  return latest && latest.changed_by !== 'import' ? latest : null
}

interface Target {
  cheque: Cheque
  change: ChequeHistory | null
}

/**
 * Shared "undo last status change" behaviour with a confirmation dialog.
 * Returns a request function and the dialog element for the caller to render.
 */
export function useRollbackAction(onChanged: () => void) {
  const [target, setTarget] = useState<Target | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Undo stays open on the Free plan (plan item 55).
  const requestRollback = async (cheque: Cheque) => {
    if (isLegacyRepresented(cheque)) {
      toast.error('This cheque was re-presented with the old flow and cannot be rolled back.')
      return
    }
    const { data, error } = await supabase
      .from('cheque_history')
      .select('*')
      .eq('cheque_id', cheque.id)
    if (error) {
      toast.error(error.message)
      return
    }
    setTarget({ cheque, change: findUndoableChange((data ?? []) as ChequeHistory[]) })
  }

  const confirm = async () => {
    if (!target?.change) return
    setSubmitting(true)
    const result = await rollbackChequeStatus(target.cheque.id)
    setSubmitting(false)
    if (!result.success) {
      toast.error(`Rollback failed: ${result.error}`)
      return
    }
    toast.success(
      `Cheque #${target.cheque.cheque_number} rolled back to ${STATUS_LABELS[result.status as ChequeStatus] ?? result.status}`
    )
    setTarget(null)
    onChanged()
  }

  const change = target?.change
  const rollbackDialog = (
    <AlertDialog open={!!target} onOpenChange={(o) => { if (!o && !submitting) setTarget(null) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {change ? `Roll back cheque #${target?.cheque.cheque_number}?` : 'Nothing to roll back'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            {change ? (
              <div className="space-y-2">
                <p>
                  This undoes the last status change,{' '}
                  <span className="font-medium text-foreground">
                    {STATUS_LABELS[change.from_status] ?? change.from_status} → {STATUS_LABELS[change.to_status] ?? change.to_status}
                  </span>{' '}
                  ({formatDateTime(change.created_at)}). The cheque goes back to{' '}
                  <span className="font-medium text-foreground">{STATUS_LABELS[change.from_status] ?? change.from_status}</span>.
                </p>
                {change.to_status === 'PENDING' && change.from_status === 'RETURNED' && (
                  <p>The re-presentation is undone and the previous due date is restored.</p>
                )}
                <p>The rollback is recorded in the history. You can roll back again to go further back.</p>
              </div>
            ) : (
              <p>This cheque has no status changes to undo.</p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>{change ? 'Cancel' : 'Close'}</AlertDialogCancel>
          {change && (
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void confirm() }}
              disabled={submitting}
            >
              {submitting ? 'Rolling back...' : 'Roll back'}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { requestRollback, rollbackDialog }
}
