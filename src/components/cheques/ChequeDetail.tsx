import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Undo2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
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
import { formatCurrency, formatDate, formatDateTime, localizeIsoDates } from '@/lib/formatters'
import { StatusPill } from '@/components/shared/StatusPill'
import { DaysUntilDue } from '@/components/shared/DaysUntilDue'
import { Skeleton } from '@/components/ui/skeleton'
import { getChequeTags, isLegacyRepresented, replacementChequePath, stripTagLines } from '@/lib/chequeTags'
import { RePresentDrawer } from './RePresentDrawer'
import { WriteOffDialog } from './WriteOffDialog'
import { useRollbackAction, findUndoableChange } from './RollbackDialog'
import { ChequeStatusActions } from './StatusActions'
import { STATUS_LABELS, type Cheque, type ChequeHistory } from '@/types'
import { toast } from 'sonner'

const CHANGED_BY_LABELS: Record<string, string> = {
  manual: 'You',
  auto: 'Auto-pass',
  deposit_allocation: 'Add funds',
  rollback: 'Rolled back',
  velo: 'Assistant',
  import: 'Import',
}

interface ChequeDetailProps {
  chequeId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (cheque: Cheque) => void
  onRefresh: () => void
}

export function ChequeDetail({ chequeId, open, onOpenChange, onEdit, onRefresh }: ChequeDetailProps) {
  const navigate = useNavigate()
  const [cheque, setCheque] = useState<Cheque | null>(null)
  const [history, setHistory] = useState<ChequeHistory[]>([])
  // Replacement links: the cheque this one replaces, or the ones issued in its place.
  const [replaces, setReplaces] = useState<Pick<Cheque, 'id' | 'cheque_number'> | null>(null)
  const [replacedBy, setReplacedBy] = useState<Pick<Cheque, 'id' | 'cheque_number'>[]>([])

  const [rePresentOpen, setRePresentOpen] = useState(false)
  const [writeOffOpen, setWriteOffOpen] = useState(false)

  // Delete confirmation state — replaces native confirm()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const afterChange = () => { onRefresh(); onOpenChange(false) }
  const { requestRollback, rollbackDialog } = useRollbackAction(afterChange)

  const load = useCallback(async (id: string) => {
    const [chequeRes, historyRes, replacedByRes] = await Promise.all([
      supabase.from('cheques').select('*, party:parties(*)').eq('id', id).single(),
      supabase.from('cheque_history').select('*').eq('cheque_id', id).order('created_at', { ascending: false }),
      supabase.from('cheques').select('id, cheque_number').eq('replaces_cheque_id', id).is('deleted_at', null),
    ])
    const c = chequeRes.data as Cheque | null
    if (c) setCheque(c)
    if (historyRes.data) setHistory(historyRes.data as ChequeHistory[])
    setReplacedBy(replacedByRes.data ?? [])
    if (c?.replaces_cheque_id) {
      const { data } = await supabase
        .from('cheques')
        .select('id, cheque_number')
        .eq('id', c.replaces_cheque_id)
        .maybeSingle()
      setReplaces(data)
    } else {
      setReplaces(null)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setCheque(null)
      setHistory([])
      setReplaces(null)
      setReplacedBy([])
      setRePresentOpen(false)
      setWriteOffOpen(false)
      setDeleteOpen(false)
      return
    }
    if (!chequeId) return
    setCheque(null)
    void load(chequeId)
  }, [chequeId, open, load])

  const handleDelete = async () => {
    if (!cheque) return
    setDeleting(true)
    const { error } = await supabase
      .from('cheques')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', cheque.id)
    setDeleting(false)
    if (error) {
      toast.error(`Failed to delete: ${error.message}`)
      return
    }
    setDeleteOpen(false)
    toast.success('Cheque deleted')
    onRefresh()
    onOpenChange(false)
  }

  const legacyRepresented = cheque ? isLegacyRepresented(cheque) : false
  const canRollback = !!cheque && !legacyRepresented && !!findUndoableChange(history)
  const tags = cheque ? getChequeTags(cheque) : []
  const visibleNotes = cheque ? stripTagLines(cheque.notes) : ''

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{cheque ? `Cheque #${cheque.cheque_number}` : 'Cheque Details'}</SheetTitle>
          </SheetHeader>
          {!cheque ? (
            <div className="mt-6 space-y-4">
              <div className="flex justify-between">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-24" />
              </div>
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <StatusPill status={cheque.status} />
                <DaysUntilDue dueDate={cheque.due_date} status={cheque.status} />
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span key={tag.key} className={`text-xs font-medium px-2 py-0.5 rounded-full ${tag.className}`}>
                      {tag.label}
                    </span>
                  ))}
                </div>
              )}
              <div className="grid gap-2">
                <p><span className="text-muted-foreground">Party:</span> {cheque.party?.name}</p>
                <p><span className="text-muted-foreground">Bank:</span> {cheque.bank_name}</p>
                <p><span className="text-muted-foreground">Amount:</span> {formatCurrency(Number(cheque.amount))}</p>
                <p><span className="text-muted-foreground">Issue Date:</span> {formatDate(cheque.issue_date)}</p>
                {cheque.original_due_date && cheque.original_due_date !== cheque.due_date ? (
                  <>
                    <p><span className="text-muted-foreground">Cheque Date:</span> {formatDate(cheque.original_due_date)}</p>
                    <p><span className="text-muted-foreground">Due Date (re-presented):</span> {formatDate(cheque.due_date)}</p>
                  </>
                ) : (
                  <p><span className="text-muted-foreground">Due Date:</span> {formatDate(cheque.due_date)}</p>
                )}
                {cheque.return_reason && (
                  <p>
                    <span className="text-muted-foreground">
                      {cheque.status === 'RETURNED' ? 'Return Reason:' : 'Last Return Reason:'}
                    </span>{' '}
                    {cheque.return_reason}
                  </p>
                )}
                {cheque.status === 'WRITTEN_OFF' && cheque.write_off_reason && (
                  <p><span className="text-muted-foreground">Write-off Reason:</span> {cheque.write_off_reason}</p>
                )}
                {replaces && (
                  <p><span className="text-muted-foreground">Replaces:</span> written-off cheque #{replaces.cheque_number}</p>
                )}
                {replacedBy.length > 0 && (
                  <p>
                    <span className="text-muted-foreground">Replaced by:</span>{' '}
                    {replacedBy.map((r) => `#${r.cheque_number}`).join(', ')}
                  </p>
                )}
                {visibleNotes && (
                  <p><span className="text-muted-foreground">Notes:</span> {visibleNotes}</p>
                )}
              </div>

              <ChequeStatusActions cheque={cheque} onChanged={afterChange} />

              {cheque.status === 'RETURNED' && (
                legacyRepresented ? (
                  <p className="text-xs text-muted-foreground italic">
                    Re-presented earlier as a separate cheque entry (tagged "From Return").
                  </p>
                ) : (
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Returned cheque
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => setRePresentOpen(true)}>Re-present</Button>
                      <Button size="sm" variant="outline" onClick={() => setWriteOffOpen(true)}>Write Off</Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      Re-present when the party will deposit this same cheque again. Write off if the cheque can't be used.
                    </p>
                  </div>
                )
              )}

              {cheque.status === 'WRITTEN_OFF' && replacedBy.length === 0 && (
                <Button size="sm" variant="outline" onClick={() => navigate(replacementChequePath(cheque.id))}>
                  Issue new cheque
                </Button>
              )}

              <div>
                <h4 className="font-medium mb-2">Status History</h4>
                <div className="space-y-2">
                  {history.map((h) => (
                    <div key={h.id} className="border-l-2 border-muted pl-3 py-1">
                      <p>
                        {h.changed_by === 'import'
                          ? `Imported as ${STATUS_LABELS[h.to_status] ?? h.to_status}`
                          : `${STATUS_LABELS[h.from_status] ?? h.from_status} → ${STATUS_LABELS[h.to_status] ?? h.to_status}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {CHANGED_BY_LABELS[h.changed_by] ?? h.changed_by} · {formatDateTime(h.created_at)}
                      </p>
                      {h.note && <p className="text-xs">{localizeIsoDates(h.note)}</p>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-4">
                <Button variant="outline" onClick={() => onEdit(cheque)}>Edit</Button>
                {canRollback && (
                  <Button variant="outline" onClick={() => void requestRollback(cheque)}>
                    <Undo2 className="h-4 w-4" />
                    Roll back
                  </Button>
                )}
                <Button variant="destructive" onClick={() => setDeleteOpen(true)}>Delete</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <RePresentDrawer
        cheque={cheque}
        open={rePresentOpen}
        onOpenChange={setRePresentOpen}
        onSuccess={afterChange}
      />

      <WriteOffDialog
        cheque={cheque}
        open={writeOffOpen}
        onOpenChange={setWriteOffOpen}
        onSuccess={afterChange}
      />

      {rollbackDialog}

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={(o) => !deleting && setDeleteOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete cheque #{cheque?.cheque_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This soft-deletes the cheque. Its history is preserved, but it will no
              longer appear in lists, calendars, or reports.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
