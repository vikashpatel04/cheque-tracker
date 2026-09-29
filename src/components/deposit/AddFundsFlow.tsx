import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DateInput } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useSettings } from '@/hooks/useSettings'
import { suggestAllocation } from '@/lib/allocationEngine'
import { announceDataChange } from '@/lib/dataEvents'
import { fetchAllRows } from '@/lib/fetchAll'
import { currencySymbol, formatAmountInput, formatMoney, formatShortDate, parseAmount, todayISO } from '@/lib/formatters'
import { recordDeposit } from '@/lib/updateChequeStatus'
import { cn } from '@/lib/utils'
import type { AllocationSort, Cheque, Party } from '@/types'
import { HelpLink } from '@/components/guide/HelpLink'

type Pending = Cheque & { party: Party }

const ORDERS: { value: AllocationSort; label: string }[] = [
  { value: 'due_date_asc', label: 'Soonest due first' },
  { value: 'amount_asc', label: 'Smallest first' },
  { value: 'amount_desc', label: 'Largest first' },
]

interface AddFundsFlowProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Starts the amount at what's needed, e.g. from Today. */
  amount?: number
}

/**
 * Add funds (plan item 71): the money put into the bank, and the pending
 * cheques it covers, ticked for you and all marked funded at once. "Funds
 * added today" counts only today's, so it starts from zero each day.
 */
export function AddFundsFlow({ open, onOpenChange, amount: suggested }: AddFundsFlowProps) {
  const { allocationSort } = useSettings()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const [order, setOrder] = useState<AllocationSort>(allocationSort)
  const [pending, setPending] = useState<Pending[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setAmount(suggested ? formatAmountInput(String(suggested)) : '')
    setDate(todayISO())
    setNotes('')
    setOrder(allocationSort)
    setPending(null)
    void fetchAllRows<Pending>('cheques', '*, party:parties(*)', {
      activeOnly: true,
      oneOf: { column: 'status', values: ['PENDING'] },
    }).then(({ rows }) => setPending(rows))
    // Only when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const value = parseAmount(amount)

  // Ticked for you whenever the amount or the order changes; your own ticks count after that.
  const suggestion = useMemo(() => (pending ? suggestAllocation(pending, value, order) : []), [pending, value, order])
  useEffect(() => {
    setSelected(new Set(suggestion.filter((i) => i.selected).map((i) => i.cheque.id)))
  }, [suggestion])

  const covered = suggestion.filter((i) => selected.has(i.cheque.id))
  const coveredTotal = covered.reduce((sum, i) => sum + Number(i.cheque.amount), 0)
  const leftOver = value - coveredTotal
  const today = todayISO()

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const save = async () => {
    if (!(value > 0)) return
    setSaving(true)
    const result = await recordDeposit(value, date, [...selected], notes.trim() || undefined)
    setSaving(false)
    if (!result.success) {
      toast.error(`Couldn't add the funds: ${result.error}`)
      return
    }
    toast.success(
      covered.length
        ? `${formatMoney(value)} added, and ${covered.length} cheque${covered.length === 1 ? '' : 's'} marked funded`
        : `${formatMoney(value)} added`
    )
    announceDataChange()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto bg-background p-0 sm:max-w-[520px] [&>button:last-child]:hidden">
        <div className="sticky top-0 z-10 flex h-[60px] shrink-0 items-center gap-1 border-b bg-background/95 px-2 backdrop-blur">
          <Button variant="ghost" size="icon" aria-label="Close" onClick={() => onOpenChange(false)}>
            <X />
          </Button>
          <SheetTitle className="text-lg font-semibold">Add funds</SheetTitle>
        </div>

        <div className="flex flex-1 flex-col gap-[18px] px-4 pt-[18px]">
          <SheetDescription className="text-sm leading-5 text-ink-quiet">
            Record money you put into the bank, then tick the cheques it covers: they're all marked funded at once. Today's
            total starts again from zero tomorrow.
          </SheetDescription>
          <HelpLink topic="add-funds" className="-mt-2">
            How Add funds works
          </HelpLink>

          <div className="flex flex-col">
            <Label htmlFor="funds-amount" className="font-semibold">
              How much did you put in the bank?
            </Label>
            <div className="flex h-[60px] items-center gap-2 rounded-xl border-2 border-brand bg-surface px-3.5 focus-within:ring-2 focus-within:ring-ring/40">
              <span className="text-[22px] text-ink-quiet">{currencySymbol()}</span>
              <input
                id="funds-amount"
                inputMode="decimal"
                placeholder="0"
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-[26px] font-semibold tabular-nums outline-none"
                value={amount}
                onChange={(e) => setAmount(formatAmountInput(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <Label htmlFor="funds-date" className="font-semibold">
                Date
              </Label>
              <DateInput id="funds-date" value={date} onChange={setDate} />
            </div>
            <div className="flex flex-col">
              <Label htmlFor="funds-notes" className="font-semibold">
                Note <span className="font-normal text-ink-quiet">(optional)</span>
              </Label>
              <Input id="funds-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <section aria-labelledby="funds-covers" className="flex flex-col gap-2.5">
            <div className="flex items-end justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <h2 id="funds-covers" className="text-[17px] font-semibold">
                  Which cheques does it cover?
                </h2>
                <span className="text-sm text-ink-quiet">Ticked for you, {ORDERS.find((o) => o.value === order)?.label.toLowerCase()}</span>
              </div>
              <Select value={order} onValueChange={(v) => setOrder(v as AllocationSort)}>
                <SelectTrigger aria-label="Order" className="h-11 w-auto border-0 bg-transparent px-1 text-sm font-semibold text-brand">
                  <SelectValue placeholder="Order" />
                </SelectTrigger>
                <SelectContent align="end">
                  {ORDERS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {pending === null ? (
              <p className="text-sm text-ink-quiet">Loading…</p>
            ) : suggestion.length === 0 ? (
              <p className="rounded-xl border bg-surface p-4 text-sm text-ink-quiet">
                No cheques are waiting for funds. You can still record the money you put in.
              </p>
            ) : (
              suggestion.map(({ cheque }) => {
                const ticked = selected.has(cheque.id)
                const chequeAmount = Number(cheque.amount)
                const short = !ticked && value > 0 && chequeAmount > leftOver ? chequeAmount - Math.max(0, leftOver) : 0
                const overdue = cheque.due_date < today
                const dueToday = cheque.due_date === today
                return (
                  <label
                    key={cheque.id}
                    className={cn(
                      'grid cursor-pointer grid-cols-[24px_minmax(0,1fr)_auto] items-start gap-3 rounded-xl bg-surface p-3.5',
                      ticked ? 'border-2 border-brand p-[13px]' : 'border'
                    )}
                  >
                    <Checkbox checked={ticked} onCheckedChange={() => toggle(cheque.id)} className="mt-0.5" />
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="truncate text-base font-semibold">{cheque.party?.name}</span>
                      <span className="flex items-center gap-1.5 text-[13px] text-ink-quiet">
                        <span className="font-cheque">{cheque.cheque_number}</span>
                        <span aria-hidden="true">·</span>
                        <span className={cn(overdue && 'font-semibold text-problem', dueToday && 'font-semibold text-attention')}>
                          {overdue ? `was due ${formatShortDate(cheque.due_date)}` : dueToday ? 'due today' : `due ${formatShortDate(cheque.due_date)}`}
                        </span>
                      </span>
                      {short > 0 && <span className="text-[13px] text-attention">Needs {formatMoney(short)} more than is left over</span>}
                    </span>
                    <span className="text-[17px] font-semibold tabular-nums">{formatMoney(chequeAmount)}</span>
                  </label>
                )
              })
            )}
          </section>

          <div className="sticky bottom-0 -mx-4 mt-auto flex flex-col gap-2.5 border-t bg-surface px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3.5">
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-ink-quiet">Adding</span>
                <span className="font-semibold tabular-nums">{formatMoney(value)}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-ink-quiet">Covers {covered.length}</span>
                <span className="font-semibold tabular-nums">{formatMoney(coveredTotal)}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-ink-quiet">{leftOver < 0 ? 'Short by' : 'Left over'}</span>
                <span className={cn('font-semibold tabular-nums', leftOver < 0 && 'text-problem')}>{formatMoney(Math.abs(leftOver))}</span>
              </div>
            </div>
            <Button size="lg" className="h-[52px] text-[17px]" disabled={!(value > 0) || saving} onClick={() => void save()}>
              {saving ? 'Saving…' : covered.length ? `Add funds and mark ${covered.length} funded` : 'Add funds'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
