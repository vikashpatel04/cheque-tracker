import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownLeft, EllipsisVertical, Landmark, Pencil, RotateCcw, Trash2, Undo2 } from 'lucide-react'
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
import { RowStatus, RowTags } from '@/components/cheques/RowChips'
import { ReceivedActionDialog, type ReceivedActionMode } from '@/components/received/ReceivedActionDialog'
import { useAppActions } from '@/hooks/useAppActions'
import { usePlan } from '@/hooks/usePlan'
import { accountLabel } from '@/lib/bankAccounts'
import { dueNote, receivedRow, rowTags } from '@/lib/chequeList'
import { announceDataChange } from '@/lib/dataEvents'
import { formatDateTime, formatMoney, formatShortDate, formatSigned, localizeIsoDates, todayISO } from '@/lib/formatters'
import { deleteReceivedCheque, rollbackReceivedCheque } from '@/lib/receivedCheques'
import { lastValidDay } from '@/lib/receivedSchedule'
import { getActiveRegion } from '@/lib/region'
import { RECEIVED_STATUS_CHIPS } from '@/lib/statusChips'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  RECEIVED_STATUS_LABELS,
  SETTLEMENT_METHOD_LABELS,
  type ReceivedCheque,
  type ReceivedChequeHistory,
} from '@/types/received'
import { HelpLink } from '@/components/guide/HelpLink'

const CHANGED_BY: Record<string, string> = { manual: 'You', auto: 'Automatically', rollback: 'Undone' }
const DOT: Record<string, string> = {
  waiting: 'bg-waiting',
  progress: 'bg-progress',
  cleared: 'bg-cleared',
  done: 'bg-done',
  attention: 'bg-attention',
  problem: 'bg-problem',
  outline: 'bg-line-strong',
}

type ChequeLink = Pick<ReceivedCheque, 'id' | 'cheque_number'>

interface ReceivedChequeDetailProps {
  chequeId: string | null
  onClose: () => void
  onDeposit: (ids: string[]) => void
}

/** A received cheque: what to do next, its details, the party and its history. */
export function ReceivedChequeDetail({ chequeId, onClose, onDeposit }: ReceivedChequeDetailProps) {
  const app = useAppActions()
  const { guard } = usePlan()
  const [cheque, setCheque] = useState<ReceivedCheque | null>(null)
  const [history, setHistory] = useState<ReceivedChequeHistory[]>([])
  const [replaces, setReplaces] = useState<ChequeLink | null>(null)
  const [replacedBy, setReplacedBy] = useState<ChequeLink[]>([])
  const [party, setParty] = useState<{ count: number; bounced: number } | null>(null)
  const [action, setAction] = useState<ReceivedActionMode | null>(null)
  const [undoOpen, setUndoOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  // On a read-only account these explain why they can't, instead (plan item 55).
  const act = guard((mode: ReceivedActionMode) => setAction(mode))
  const askUndo = guard(() => setUndoOpen(true))
  const askDelete = guard(() => setDeleteOpen(true))

  const load = useCallback(async (id: string) => {
    const [chequeRes, historyRes, replacedByRes] = await Promise.all([
      supabase.from('received_cheques').select('*, party:parties(*), deposit_account:bank_accounts(*)').eq('id', id).single(),
      supabase.from('received_cheque_history').select('*').eq('cheque_id', id).order('created_at', { ascending: false }),
      supabase.from('received_cheques').select('id, cheque_number').eq('replaces_id', id).is('deleted_at', null),
    ])
    const c = chequeRes.data as ReceivedCheque | null
    setCheque(c)
    setHistory((historyRes.data ?? []) as ReceivedChequeHistory[])
    setReplacedBy((replacedByRes.data ?? []) as ChequeLink[])
    if (!c) return
    const [replacesRes, partyRes] = await Promise.all([
      c.replaces_id
        ? supabase.from('received_cheques').select('id, cheque_number').eq('id', c.replaces_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('received_cheques').select('status, redeposit_count').eq('party_id', c.party_id).is('deleted_at', null),
    ])
    setReplaces(replacesRes.data as ChequeLink | null)
    const theirs = partyRes.data ?? []
    setParty({ count: theirs.length, bounced: theirs.filter((p) => p.status === 'BOUNCED' || p.redeposit_count > 0).length })
  }, [])

  useEffect(() => {
    setCheque(null)
    setHistory([])
    setReplaces(null)
    setReplacedBy([])
    setParty(null)
    if (chequeId) void load(chequeId)
  }, [chequeId, load])

  const reload = () => chequeId && void load(chequeId)

  const undo = async () => {
    if (!cheque) return
    setBusy(true)
    const result = await rollbackReceivedCheque(cheque.id)
    setBusy(false)
    setUndoOpen(false)
    if (!result.success) {
      toast.error(result.error ?? "Couldn't undo it")
      return
    }
    toast.success(`Undone: it's ${RECEIVED_STATUS_LABELS[result.status ?? cheque.status].toLowerCase()} again`)
    announceDataChange()
    reload()
  }

  const remove = async () => {
    if (!cheque) return
    setBusy(true)
    const result = await deleteReceivedCheque(cheque.id)
    setBusy(false)
    if (!result.success) {
      toast.error(result.error ?? "Couldn't delete it")
      return
    }
    setDeleteOpen(false)
    toast.success('Cheque deleted')
    announceDataChange()
    onClose()
  }

  const today = todayISO()
  const { chequeValidityMonths, clearingDays } = getActiveRegion()
  const row = cheque ? receivedRow(cheque) : null
  const tags = row ? rowTags(row, today, { chequeValidityMonths, clearingDays }) : []
  const note = row ? dueNote(row, today) : null
  const security = cheque?.kind === 'SECURITY'
  const staleAfter = cheque?.cheque_date ? lastValidDay(cheque.cheque_date, chequeValidityMonths) : null

  const details: { label: string; value: React.ReactNode; mono?: boolean }[] = cheque
    ? [
        { label: 'Cheque no.', value: cheque.cheque_number, mono: true },
        { label: 'Drawn on', value: cheque.bank_name },
        ...(security ? [{ label: 'Kind', value: 'Security cheque' }] : []),
        ...(cheque.cheque_date ? [{ label: 'Cheque date', value: formatShortDate(cheque.cheque_date) }] : []),
        {
          label: security ? 'Review on' : 'Deposit on',
          value: (
            <>
              {formatShortDate(cheque.due_date)}
              {note && <span className="text-ink-quiet"> · {note}</span>}
            </>
          ),
        },
        { label: 'Received on', value: formatShortDate(cheque.received_on) },
        ...(cheque.status === 'IN_HAND' && staleAfter ? [{ label: 'Valid until', value: formatShortDate(staleAfter) }] : []),
        ...(cheque.deposit_account ? [{ label: cheque.deposited_on ? 'Deposited into' : 'To deposit into', value: accountLabel(cheque.deposit_account) }] : []),
        ...(cheque.deposited_on ? [{ label: 'Deposited on', value: formatShortDate(cheque.deposited_on) }] : []),
        ...(cheque.redeposit_count > 0 ? [{ label: 'Deposited again', value: `${cheque.redeposit_count} time${cheque.redeposit_count === 1 ? '' : 's'}` }] : []),
        ...(cheque.cleared_on ? [{ label: 'Cleared on', value: formatShortDate(cheque.cleared_on) }] : []),
        ...(cheque.bounced_on ? [{ label: 'Bounced on', value: formatShortDate(cheque.bounced_on) }] : []),
        ...(cheque.bounce_reason ? [{ label: 'Why it bounced', value: cheque.bounce_reason }] : []),
        ...(Number(cheque.bank_charges) > 0 ? [{ label: 'Bank charges', value: formatMoney(Number(cheque.bank_charges)) }] : []),
        ...(cheque.settled_on
          ? [
              {
                label: 'Paid another way',
                value: `${cheque.settled_via ? SETTLEMENT_METHOD_LABELS[cheque.settled_via] : 'Settled'} · ${formatShortDate(cheque.settled_on)}${cheque.settlement_ref ? ` · ${cheque.settlement_ref}` : ''}`,
              },
            ]
          : []),
        ...(cheque.close_reason ? [{ label: cheque.status === 'HANDED_BACK' ? 'Handed back because' : 'Why', value: cheque.close_reason }] : []),
        ...(cheque.series_index ? [{ label: 'In a series', value: `Cheque no. ${cheque.series_index}` }] : []),
        ...(replaces
          ? [
              {
                label: 'Replaces',
                value: (
                  <button type="button" className="font-cheque text-brand underline underline-offset-[3px]" onClick={() => app.openReceivedCheque(replaces.id)}>
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
                      <button key={r.id} type="button" className="font-cheque text-brand underline underline-offset-[3px]" onClick={() => app.openReceivedCheque(r.id)}>
                        {r.cheque_number}
                      </button>
                    ))}
                  </span>
                ),
              },
            ]
          : []),
        ...(cheque.notes ? [{ label: 'Notes', value: cheque.notes }] : []),
      ]
    : []

  const next = (() => {
    if (!cheque) return null
    const card = (tone: 'plain' | 'problem', title: string, text: string, children: React.ReactNode) => (
      <section aria-label="What happens next" className={cn('flex flex-col gap-3.5 rounded-xl border bg-surface p-4', tone === 'problem' && 'border-problem-line')}>
        <div className="flex flex-col gap-1">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          <span className="text-sm leading-5 text-ink-quiet">{text}</span>
        </div>
        {children}
      </section>
    )
    const otherWays = (
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="lg" onClick={() => act('settle')}>
          Paid another way
        </Button>
        <Button variant="outline" size="lg" onClick={() => act('replace')}>
          Got a new cheque
        </Button>
      </div>
    )
    switch (cheque.status) {
      case 'IN_HAND':
        if (security) {
          return card(
            'plain',
            'Held as security',
            `Review it on ${formatShortDate(cheque.due_date)}. Hand it back when it's no longer needed.`,
            <>
              <Button variant="outline" size="lg" onClick={() => act('hand_back')}>
                <Undo2 />
                Hand it back
              </Button>
              {cheque.amount !== null && cheque.cheque_date && (
                <Button variant="outline" size="lg" onClick={() => onDeposit([cheque.id])}>
                  <Landmark />
                  Deposit it
                </Button>
              )}
              <Button variant="ghost" className="text-problem hover:text-problem" onClick={() => act('write_off')}>
                Write it off…
              </Button>
            </>
          )
        }
        return card(
          'plain',
          cheque.due_date <= today ? 'Deposit it' : 'Waiting to be deposited',
          `${cheque.due_date < today ? 'Was due' : 'Deposit on'} ${formatShortDate(cheque.due_date)}${note ? ` · ${note}` : ''}${staleAfter ? `. Valid until ${formatShortDate(staleAfter)}.` : '.'}`,
          <>
            <Button size="lg" onClick={() => onDeposit([cheque.id])}>
              <Landmark />
              Deposit
            </Button>
            {otherWays}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => act('hand_back')}>
                Hand it back
              </Button>
              <Button variant="ghost" className="text-problem hover:text-problem" onClick={() => act('write_off')}>
                Write it off…
              </Button>
            </div>
          </>
        )
      case 'DEPOSITED':
        return card(
          'plain',
          'Did it clear?',
          `Deposited ${cheque.deposited_on ? formatShortDate(cheque.deposited_on) : ''}${cheque.deposit_account ? ` into ${accountLabel(cheque.deposit_account)}` : ''}. It usually takes ${clearingDays} day${clearingDays === 1 ? '' : 's'}.`,
          <>
            <Button size="lg" onClick={() => act('clear')}>
              Mark cleared
            </Button>
            <Button variant="ghost" className="text-problem hover:text-problem" onClick={() => act('bounce')}>
              It bounced…
            </Button>
          </>
        )
      case 'BOUNCED':
        return card(
          'problem',
          'What happens next?',
          `Bounced${cheque.bounced_on ? ` on ${formatShortDate(cheque.bounced_on)}` : ''}${cheque.bounce_reason ? `: ${cheque.bounce_reason}` : ''}.${Number(cheque.bank_charges) > 0 ? ` Your bank charged ${formatMoney(Number(cheque.bank_charges))}.` : ''}`,
          <>
            <Button size="lg" onClick={() => act('redeposit')}>
              <Landmark />
              Deposit it again
            </Button>
            {otherWays}
            <Button variant="ghost" className="text-problem hover:text-problem" onClick={() => act('write_off')}>
              Write it off…
            </Button>
          </>
        )
      default:
        return null
    }
  })()

  return (
    <>
      <Sheet open={!!chequeId} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto bg-background p-0 sm:max-w-[520px] [&>button:last-child]:hidden">
          <div className="sticky top-0 z-10 flex h-[60px] shrink-0 items-center justify-between border-b bg-background/95 px-2 backdrop-blur">
            <Button variant="ghost" className="text-brand" onClick={onClose}>
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
                  <DropdownMenuItem
                    onSelect={guard(() => {
                      onClose()
                      app.editReceivedCheque(cheque)
                    })}
                  >
                    <Pencil className="text-ink-quiet" />
                    Edit
                  </DropdownMenuItem>
                  {history.length > 0 && (
                    <DropdownMenuItem onSelect={askUndo}>
                      <Undo2 className="text-ink-quiet" />
                      Undo last change
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={askDelete} className="text-problem focus:text-problem">
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
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
          ) : (
            <div className="flex flex-col gap-4 px-4 pb-8 pt-[18px]">
              <div className="flex flex-col gap-1.5">
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-money-in">
                  <ArrowDownLeft className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
                  Received from
                </span>
                <SheetTitle className="font-title text-[28px] leading-[34px]">{cheque.party?.name ?? 'Unknown party'}</SheetTitle>
                <span className="text-[34px] font-semibold leading-[42px] tabular-nums text-money-in">
                  {cheque.amount === null ? <span className="text-2xl text-ink-quiet">No amount</span> : formatSigned(Number(cheque.amount), 'in')}
                </span>
                <SheetDescription asChild>
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    {row && <RowStatus row={row} size="md" />}
                    <RowTags tags={tags} size="md" />
                    <span className="font-cheque text-sm text-ink-quiet">{cheque.cheque_number}</span>
                  </div>
                </SheetDescription>
              </div>

              {next}

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
                      ? `${party.count} cheque${party.count === 1 ? '' : 's'} from them${party.bounced ? ` · ${party.bounced} bounced` : ''}`
                      : ' '}
                  </span>
                </div>
                <Link to={`/parties/${cheque.party_id}`} onClick={onClose} className="inline-flex h-11 shrink-0 items-center font-semibold text-brand">
                  Ledger
                </Link>
              </section>

              <section aria-labelledby="received-history" className="flex flex-col gap-1 rounded-xl border bg-surface p-4">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h2 id="received-history" className="text-base font-semibold">
                    History
                  </h2>
                  <HelpLink topic="received" className="text-[13px]">
                    How a cheque you receive moves along
                  </HelpLink>
                </div>
                {history.length === 0 ? (
                  <p className="text-sm text-ink-quiet">Added {formatShortDate(cheque.created_at)}. Changes will show here.</p>
                ) : (
                  history.map((h, i) => (
                    <div key={h.id} className="grid grid-cols-[24px_minmax(0,1fr)] gap-3">
                      <div className="flex flex-col items-center">
                        <span className={cn('mt-[5px] h-3 w-3 rounded-full', DOT[RECEIVED_STATUS_CHIPS[h.to_status]?.tone ?? 'done'])} aria-hidden="true" />
                        {i < history.length - 1 && <span className="w-0.5 flex-1 bg-line" aria-hidden="true" />}
                      </div>
                      <div className="flex flex-col gap-0.5 pb-4">
                        <span className="text-[15px] font-semibold">
                          {RECEIVED_STATUS_LABELS[h.to_status]}
                          {h.from_status !== h.to_status && (
                            <span className="font-normal text-ink-quiet"> · was {RECEIVED_STATUS_LABELS[h.from_status].toLowerCase()}</span>
                          )}
                        </span>
                        <span className="text-sm text-ink-quiet">
                          {CHANGED_BY[h.changed_by] ?? h.changed_by} · {formatDateTime(h.created_at)}
                        </span>
                        {h.note && <span className="text-sm">{localizeIsoDates(h.note)}</span>}
                      </div>
                    </div>
                  ))
                )}
                {history.length > 0 && (
                  <Button variant="link" className="h-11 self-start px-0.5" onClick={askUndo}>
                    <RotateCcw />
                    Undo last change
                  </Button>
                )}
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ReceivedActionDialog mode={action} cheque={cheque} onClose={() => setAction(null)} onDone={reload} />

      <AlertDialog open={undoOpen} onOpenChange={(o) => !busy && setUndoOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo the last change?</AlertDialogTitle>
            <AlertDialogDescription>
              {history[0]
                ? `It goes back from ${RECEIVED_STATUS_LABELS[history[0].to_status].toLowerCase()} to ${RECEIVED_STATUS_LABELS[history[0].from_status].toLowerCase()}.`
                : 'It goes back to how it was before.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                void undo()
              }}
            >
              {busy ? 'Undoing…' : 'Undo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={(o) => !busy && setDeleteOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete cheque {cheque?.cheque_number}?</AlertDialogTitle>
            <AlertDialogDescription>It disappears from lists and reports. Its history is kept.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                void remove()
              }}
              className="border border-problem-line bg-surface text-problem hover:bg-problem-soft"
            >
              {busy ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
