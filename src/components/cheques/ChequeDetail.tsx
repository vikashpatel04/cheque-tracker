import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Ban, CheckCheck, EllipsisVertical, Pencil, RotateCcw, Trash2, Undo2, Wallet } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { RowTags } from '@/components/cheques/RowChips'
import { StatusPill } from '@/components/shared/StatusPill'
import { useAppActions } from '@/hooks/useAppActions'
import { dueNote, givenRow, rowTags } from '@/lib/chequeList'
import { isLegacyRepresented, stripTagLines } from '@/lib/chequeTags'
import { formatDateTime, formatMoney, formatShortDate, formatSigned, localizeIsoDates, todayISO } from '@/lib/formatters'
import { getActiveRegion } from '@/lib/region'
import { GIVEN_STATUS_CHIPS } from '@/lib/statusChips'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { STATUS_LABELS, type Cheque, type ChequeHistory } from '@/types'
import { PresentAgainDialog } from './PresentAgainDialog'
import { findUndoableChange, useRollbackAction } from './RollbackDialog'
import { useChequeStatusActions } from './StatusActions'
import { WriteOffDialog } from './WriteOffDialog'
import { HelpLink } from '@/components/guide/HelpLink'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { accountLabel } from '@/lib/bankAccounts'

const CHANGED_BY_LABELS: Record<string, string> = {
  manual: 'You',
  auto: 'Auto-pass',
  deposit_allocation: 'Add funds',
  rollback: 'Undone',
  velo: 'The assistant',
  import: 'Import',
}

const DOT: Record<string, string> = {
  waiting: 'bg-waiting',
  progress: 'bg-progress',
  cleared: 'bg-cleared',
  done: 'bg-done',
  attention: 'bg-attention',
  problem: 'bg-problem',
  outline: 'bg-line-strong',
}

interface ChequeDetailProps {
  chequeId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (cheque: Cheque) => void
  onRefresh: () => void
}

interface PartySummary {
  count: number
  toPay: number
}

/** A given cheque: what to do next, its details, its party and its history (design screen 34). */
export function ChequeDetail({ chequeId, open, onOpenChange, onEdit, onRefresh }: ChequeDetailProps) {
  const app = useAppActions()
  const [cheque, setCheque] = useState<Cheque | null>(null)
  const [history, setHistory] = useState<ChequeHistory[]>([])
  const { accounts } = useBankAccounts()
  const [party, setParty] = useState<PartySummary | null>(null)
  // Replacement links: the cheque this one replaces, or the ones issued in its place.
  const [replaces, setReplaces] = useState<Pick<Cheque, 'id' | 'cheque_number'> | null>(null)
  const [replacedBy, setReplacedBy] = useState<Pick<Cheque, 'id' | 'cheque_number'>[]>([])
  const [rePresentOpen, setRePresentOpen] = useState(false)
  const [writeOffOpen, setWriteOffOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async (id: string) => {
    const [chequeRes, historyRes, replacedByRes] = await Promise.all([
      supabase.from('cheques').select('*, party:parties(*)').eq('id', id).single(),
      supabase.from('cheque_history').select('*').eq('cheque_id', id).order('created_at', { ascending: false }),
      supabase.from('cheques').select('id, cheque_number').eq('replaces_cheque_id', id).is('deleted_at', null),
    ])
    const c = chequeRes.data as Cheque | null
    setCheque(c)
    setHistory((historyRes.data ?? []) as ChequeHistory[])
    setReplacedBy(replacedByRes.data ?? [])
    if (!c) return
    const [replacesRes, partyRes] = await Promise.all([
      c.replaces_cheque_id
        ? supabase.from('cheques').select('id, cheque_number').eq('id', c.replaces_cheque_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('cheques').select('amount, status').eq('party_id', c.party_id).is('deleted_at', null),
    ])
    setReplaces(replacesRes.data)
    const partyCheques = partyRes.data ?? []
    setParty({
      count: partyCheques.length,
      toPay: partyCheques
        .filter((p) => p.status === 'PENDING' || p.status === 'DEPOSITED' || p.status === 'RETURNED')
        .reduce((sum, p) => sum + Number(p.amount), 0),
    })
  }, [])

  const afterChange = () => {
    onRefresh()
    if (chequeId) void load(chequeId)
  }
  const status = useChequeStatusActions(afterChange)
  const rollback = useRollbackAction(afterChange)

  useEffect(() => {
    setCheque(null)
    setHistory([])
    setReplaces(null)
    setReplacedBy([])
    setParty(null)
    if (open && chequeId) void load(chequeId)
  }, [chequeId, open, load])

  const handleDelete = async () => {
    if (!cheque) return
    setDeleting(true)
    const { error } = await supabase.from('cheques').update({ deleted_at: new Date().toISOString() }).eq('id', cheque.id)
    setDeleting(false)
    if (error) {
      toast.error(`Couldn't delete it: ${error.message}`)
      return
    }
    setDeleteOpen(false)
    toast.success('Cheque deleted')
    onRefresh()
    onOpenChange(false)
  }

  const today = todayISO()
  const { chequeValidityMonths, clearingDays } = getActiveRegion()
  const legacy = cheque ? isLegacyRepresented(cheque) : false
  const canUndo = !!cheque && !legacy && !!findUndoableChange(history)
  const notes = cheque ? stripTagLines(cheque.notes) : ''
  const row = cheque ? givenRow(cheque) : null
  const tags = row ? rowTags(row, today, { chequeValidityMonths, clearingDays }) : []
  const note = row ? dueNote(row, today) : null
  const amount = cheque ? Number(cheque.amount) : 0
  const drawnOn = cheque?.bank_account_id ? accounts.find((a) => a.id === cheque.bank_account_id) : undefined

  const details: { label: string; value: React.ReactNode; mono?: boolean }[] = cheque
    ? [
        { label: 'Cheque no.', value: cheque.cheque_number, mono: true },
        drawnOn
          ? { label: 'From your account', value: `${accountLabel(drawnOn)} · ${cheque.bank_name}` }
          : { label: 'Bank', value: cheque.bank_name },
        { label: 'Issued', value: formatShortDate(cheque.issue_date) },
        ...(cheque.original_due_date && cheque.original_due_date !== cheque.due_date
          ? [
              { label: 'Date on the cheque', value: formatShortDate(cheque.original_due_date) },
              { label: 'Presented again for', value: formatShortDate(cheque.due_date) },
            ]
          : [{ label: 'Due', value: <>{formatShortDate(cheque.due_date)}{note && <span className="text-ink-quiet"> · {note}</span>}</> }]),
        ...(cheque.return_reason
          ? [{ label: cheque.status === 'RETURNED' ? 'Why it came back' : 'Last time it came back', value: cheque.return_reason }]
          : []),
        ...(cheque.status === 'WRITTEN_OFF' && cheque.write_off_reason ? [{ label: 'Written off because', value: cheque.write_off_reason }] : []),
        ...(replaces
          ? [
              {
                label: 'Replaces',
                value: (
                  <button type="button" className="font-cheque text-brand underline underline-offset-[3px]" onClick={() => app.openCheque(replaces.id)}>
                    {replaces.cheque_number}
                  </button>
                ),
              },
            ]
          : []),
        ...(replacedBy.length
          ? [
              {
                label: 'Replaced by',
                value: (
                  <span className="flex flex-wrap justify-end gap-2">
                    {replacedBy.map((r) => (
                      <button key={r.id} type="button" className="font-cheque text-brand underline underline-offset-[3px]" onClick={() => app.openCheque(r.id)}>
                        {r.cheque_number}
                      </button>
                    ))}
                  </span>
                ),
              },
            ]
          : []),
        ...(notes ? [{ label: 'Notes', value: notes }] : []),
      ]
    : []

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto bg-background p-0 sm:max-w-[520px] [&>button:last-child]:hidden">
          <div className="sticky top-0 z-10 flex h-[60px] shrink-0 items-center justify-between border-b bg-background/95 px-2 backdrop-blur">
            <Button variant="ghost" className="text-brand" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {cheque && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="More actions">
                    <EllipsisVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem onSelect={() => onEdit(cheque)}>
                    <Pencil className="text-ink-quiet" />
                    Edit
                  </DropdownMenuItem>
                  {canUndo && (
                    <DropdownMenuItem onSelect={() => void rollback.requestRollback(cheque)}>
                      <Undo2 className="text-ink-quiet" />
                      Undo last change
                    </DropdownMenuItem>
                  )}
                  {(cheque.status === 'PENDING' || cheque.status === 'DEPOSITED') && (
                    <DropdownMenuItem onSelect={() => status.requestStatus(cheque, 'CANCELLED')}>
                      <Ban className="text-ink-quiet" />
                      Mark cancelled
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setDeleteOpen(true)} className="text-problem focus:text-problem">
                    <Trash2 />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {!cheque ? (
            <div className="flex flex-col gap-4 p-4">
              <SheetTitle className="sr-only">Cheque</SheetTitle>
              <SheetDescription className="sr-only">Loading the cheque</SheetDescription>
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-56 rounded-xl" />
            </div>
          ) : (
            <div className="flex flex-col gap-4 px-4 pb-8 pt-[18px]">
              <div className="flex flex-col gap-1.5">
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-quiet">
                  <ArrowUpRight className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
                  Given to
                </span>
                <SheetTitle className="font-title text-[28px] leading-[34px]">{cheque.party?.name ?? 'Unknown party'}</SheetTitle>
                <span className="text-[34px] font-semibold leading-[42px] tabular-nums">{formatSigned(amount, 'out')}</span>
                <SheetDescription asChild>
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <StatusPill status={cheque.status} size="md" />
                    <RowTags tags={tags} size="md" />
                    <span className="font-cheque text-sm text-ink-quiet">{cheque.cheque_number}</span>
                  </div>
                </SheetDescription>
              </div>

              <NextStep
                cheque={cheque}
                legacy={legacy}
                replaced={replacedBy.length > 0}
                note={note}
                busy={status.submitting}
                onFunded={() => status.requestStatus(cheque, 'DEPOSITED')}
                onFundAndPass={() => status.requestChained(cheque)}
                onPassed={() => status.requestStatus(cheque, 'PASSED')}
                onReturned={() => status.requestStatus(cheque, 'RETURNED')}
                onPresent={() => setRePresentOpen(true)}
                onWriteOff={() => setWriteOffOpen(true)}
                onReplace={() => app.replaceCheque(cheque)}
              />

              <section aria-label="Details" className="flex flex-col rounded-xl border bg-surface">
                {details.map((d) => (
                  <div key={d.label} className="flex justify-between gap-4 border-b border-line-soft px-4 py-[13px] last:border-0">
                    <span className="text-sm text-ink-quiet">{d.label}</span>
                    <span className={cn('text-right text-[15px] font-medium', d.mono && 'font-cheque')}>{d.value}</span>
                  </div>
                ))}
              </section>

              <section aria-label="Party" className="flex items-center justify-between gap-3 rounded-xl border bg-surface p-4">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-semibold">{cheque.party?.name}</span>
                  <span className="text-sm text-ink-quiet">
                    {party
                      ? `${party.count} cheque${party.count === 1 ? '' : 's'} to them${party.toPay ? ` · ${formatMoney(party.toPay)} still to pay` : ''}`
                      : ' '}
                  </span>
                </div>
                <Link to={`/parties/${cheque.party_id}`} onClick={() => onOpenChange(false)} className="inline-flex h-11 shrink-0 items-center font-semibold text-brand">
                  Ledger
                </Link>
              </section>

              <section aria-labelledby="history-title" className="flex flex-col gap-1 rounded-xl border bg-surface p-4">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h2 id="history-title" className="text-base font-semibold">
                    History
                  </h2>
                  <HelpLink topic="given" className="text-[13px]">
                    How a cheque you give moves along
                  </HelpLink>
                </div>
                {history.length === 0 ? (
                  <p className="text-sm text-ink-quiet">Added as {STATUS_LABELS[cheque.status]}. Changes will show here.</p>
                ) : (
                  history.map((h, i) => {
                    const tone = GIVEN_STATUS_CHIPS[h.to_status]?.tone ?? 'done'
                    const title =
                      h.changed_by === 'import'
                        ? `Imported as ${STATUS_LABELS[h.to_status] ?? h.to_status}`
                        : h.from_status === 'RETURNED' && h.to_status === 'PENDING'
                          ? 'Presented again'
                          : `${STATUS_LABELS[h.to_status] ?? h.to_status}`
                    return (
                      <div key={h.id} className="grid grid-cols-[24px_minmax(0,1fr)] gap-3">
                        <div className="flex flex-col items-center">
                          <span className={cn('mt-[5px] h-3 w-3 rounded-full', DOT[tone])} aria-hidden="true" />
                          {i < history.length - 1 && <span className="w-0.5 flex-1 bg-line" aria-hidden="true" />}
                        </div>
                        <div className="flex flex-col gap-0.5 pb-4">
                          <span className="text-[15px] font-semibold">
                            {title}
                            {h.changed_by !== 'import' && h.from_status !== h.to_status && (
                              <span className="font-normal text-ink-quiet"> · was {STATUS_LABELS[h.from_status] ?? h.from_status}</span>
                            )}
                          </span>
                          <span className="text-sm text-ink-quiet">
                            {CHANGED_BY_LABELS[h.changed_by] ?? h.changed_by} · {formatDateTime(h.created_at)}
                          </span>
                          {h.note && <span className="text-sm">{localizeIsoDates(h.note)}</span>}
                        </div>
                      </div>
                    )
                  })
                )}
                {canUndo && (
                  <Button variant="link" className="h-11 self-start px-0.5" onClick={() => void rollback.requestRollback(cheque)}>
                    <RotateCcw />
                    Undo last change
                  </Button>
                )}
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {status.returnDialog}
      {rollback.rollbackDialog}
      <PresentAgainDialog cheque={cheque} open={rePresentOpen} onOpenChange={setRePresentOpen} onSuccess={afterChange} />
      <WriteOffDialog cheque={cheque} open={writeOffOpen} onOpenChange={setWriteOffOpen} onSuccess={afterChange} />

      <AlertDialog open={deleteOpen} onOpenChange={(o) => !deleting && setDeleteOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete cheque {cheque?.cheque_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              It disappears from lists, the calendar and reports. Its history is kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
              disabled={deleting}
              className="border border-problem-line bg-surface text-problem hover:bg-problem-soft"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

interface NextStepProps {
  cheque: Cheque
  legacy: boolean
  replaced: boolean
  note: string | null
  busy: boolean
  onFunded: () => void
  onFundAndPass: () => void
  onPassed: () => void
  onReturned: () => void
  onPresent: () => void
  onWriteOff: () => void
  onReplace: () => void
}

/** The one card that says what to do next, by status. Finished cheques have none. */
function NextStep(props: NextStepProps) {
  const { cheque, legacy, replaced, note, busy } = props
  const due = `${cheque.due_date < todayISO() ? 'Was due' : 'Due'} ${formatShortDate(cheque.due_date)}${note ? ` · ${note}` : ''}`
  const card = (tone: 'plain' | 'problem', title: string, text: string, children: React.ReactNode) => (
    <section
      aria-label="What happens next"
      className={cn('flex flex-col gap-3.5 rounded-xl border bg-surface p-4', tone === 'problem' && 'border-problem-line')}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-[17px] font-semibold">{title}</h2>
        <span className="text-sm leading-5 text-ink-quiet">{text}</span>
      </div>
      {children}
    </section>
  )

  switch (cheque.status) {
    case 'PENDING':
      return card(
        'plain',
        'Is the money in the bank?',
        `${due}. Mark it funded once there's enough in the account to cover it.`,
        <>
          <Button size="lg" disabled={busy} onClick={props.onFunded}>
            <Wallet />
            Mark funded
          </Button>
          <Button variant="outline" size="lg" disabled={busy} onClick={props.onFundAndPass}>
            <CheckCheck />
            It already passed
          </Button>
          <Button variant="ghost" className="text-problem hover:text-problem" disabled={busy} onClick={props.onReturned}>
            It came back unpaid…
          </Button>
        </>
      )
    case 'DEPOSITED':
      return card(
        'plain',
        'Did it pass?',
        `Funded. ${due}.`,
        <>
          <Button size="lg" disabled={busy} onClick={props.onPassed}>
            <CheckCheck />
            Mark passed
          </Button>
          <Button variant="ghost" className="text-problem hover:text-problem" disabled={busy} onClick={props.onReturned}>
            It came back unpaid…
          </Button>
        </>
      )
    case 'RETURNED':
      if (legacy) {
        return card('plain', 'Presented again the old way', 'This cheque was presented again as a separate entry, which settled it.', null)
      }
      return card(
        'problem',
        'What happens next?',
        `It came back${cheque.return_reason ? `: ${cheque.return_reason}` : ''}. Present the same cheque again, or write it off and give a new one.`,
        <>
          <Button size="lg" disabled={busy} onClick={props.onPresent}>
            Present it again
          </Button>
          <Button variant="ghost" className="text-problem hover:text-problem" disabled={busy} onClick={props.onWriteOff}>
            Write it off…
          </Button>
        </>
      )
    case 'WRITTEN_OFF':
      if (replaced) return null
      return card(
        'plain',
        'Give a new cheque in its place?',
        `Written off${cheque.write_off_reason ? `: ${cheque.write_off_reason}` : ''}. A new cheque is filled in from this one and linked to it.`,
        <Button variant="outline" size="lg" onClick={props.onReplace}>
          Issue a new cheque
        </Button>
      )
    default:
      return null
  }
}
