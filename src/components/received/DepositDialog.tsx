import { useEffect, useMemo, useState } from 'react'
import { Landmark, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DateInput } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { accountLabel } from '@/lib/bankAccounts'
import { announceDataChange } from '@/lib/dataEvents'
import { fetchAllRows } from '@/lib/fetchAll'
import { formatMoney, formatShortDate, formatSigned, todayISO } from '@/lib/formatters'
import { depositReceivedCheques } from '@/lib/receivedCheques'
import { lastValidDay } from '@/lib/receivedSchedule'
import { getActiveRegion } from '@/lib/region'
import type { ReceivedCheque } from '@/types/received'

const NO_ACCOUNT = '__none__'

interface DepositDialogProps {
  /** Null keeps it closed; an empty list opens it with the cheques due today ticked. */
  ids: string[] | null
  onClose: () => void
}

/** Deposit cheques you received, several at once (design screen 36). */
export function DepositDialog({ ids, onClose }: DepositDialogProps) {
  const open = ids !== null
  const { accounts, defaultAccount } = useBankAccounts()
  const [cheques, setCheques] = useState<ReceivedCheque[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [date, setDate] = useState(todayISO())
  const [account, setAccount] = useState(NO_ACCOUNT)
  const [saving, setSaving] = useState(false)
  const { chequeValidityMonths, clearingDays } = getActiveRegion()

  useEffect(() => {
    if (!open) {
      setCheques(null)
      return
    }
    const today = todayISO()
    setDate(today)
    void fetchAllRows<ReceivedCheque>('received_cheques', '*, party:parties(*)', {
      activeOnly: true,
      oneOf: { column: 'status', values: ['IN_HAND'] },
    }).then(({ rows }) => {
      // Only regular cheques with an amount and a date can be deposited, and not stale ones.
      const depositable = rows
        .filter((c) => c.kind === 'REGULAR' && c.amount !== null && c.cheque_date && lastValidDay(c.cheque_date, chequeValidityMonths) >= today)
        .sort((a, b) => a.due_date.localeCompare(b.due_date))
      setCheques(depositable)
      setSelected(new Set(ids?.length ? ids : depositable.filter((c) => c.due_date <= today).map((c) => c.id)))
      const first = depositable.find((c) => ids?.includes(c.id))
      setAccount(first?.deposit_account_id ?? defaultAccount?.id ?? NO_ACCOUNT)
    })
    // Load once each time it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const chosen = useMemo(() => (cheques ?? []).filter((c) => selected.has(c.id)), [cheques, selected])
  const total = chosen.reduce((sum, c) => sum + Number(c.amount ?? 0), 0)
  const allSelected = !!cheques?.length && chosen.length === cheques.length

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const deposit = async () => {
    if (!chosen.length) return
    setSaving(true)
    const result = await depositReceivedCheques(
      chosen.map((c) => c.id),
      date,
      { accountId: account === NO_ACCOUNT ? undefined : account }
    )
    setSaving(false)
    if (!result.success) {
      toast.error(result.error ?? "Couldn't deposit them")
      return
    }
    toast.success(`Deposited ${chosen.length} cheque${chosen.length === 1 ? '' : 's'}: ${formatMoney(total)}`)
    announceDataChange()
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto bg-background p-0 sm:max-w-[520px] [&>button:last-child]:hidden">
        <div className="sticky top-0 z-10 flex h-[60px] shrink-0 items-center gap-1 border-b bg-background/95 px-2 backdrop-blur">
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X />
          </Button>
          <SheetTitle className="text-lg font-semibold">Deposit cheques</SheetTitle>
          <SheetDescription className="sr-only">Choose the cheques you're depositing and where.</SheetDescription>
        </div>

        <div className="flex flex-1 flex-col gap-[18px] px-4 pt-[18px]">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <Label htmlFor="deposit-date">Deposit date</Label>
              <DateInput id="deposit-date" value={date} onChange={setDate} />
            </div>
            <div className="flex flex-col">
              <Label htmlFor="deposit-account">Into</Label>
              <Select value={account} onValueChange={setAccount}>
                <SelectTrigger id="deposit-account">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ACCOUNT}>Not recorded</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {accountLabel(a)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <section className="flex flex-col rounded-xl border bg-surface">
            <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
              <span className="font-semibold">In hand</span>
              {!!cheques?.length && (
                <label className="flex items-center gap-2 text-sm text-ink-quiet">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(v) => setSelected(v === true ? new Set(cheques.map((c) => c.id)) : new Set())}
                  />
                  Select all
                </label>
              )}
            </div>
            {cheques === null ? (
              <p className="px-4 py-6 text-sm text-ink-quiet">Loading…</p>
            ) : cheques.length === 0 ? (
              <p className="px-4 py-6 text-sm text-ink-quiet">No cheques in hand to deposit.</p>
            ) : (
              <ul className="flex flex-col">
                {cheques.map((c) => (
                  <li key={c.id} className="border-b border-line-soft last:border-0">
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                      <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate font-semibold">{c.party?.name ?? 'Unknown party'}</span>
                        <span className="truncate text-sm text-ink-quiet">
                          <span className="font-cheque">{c.cheque_number}</span> · {c.bank_name} · due {formatShortDate(c.due_date)}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-money-in">{formatSigned(Number(c.amount), 'in')}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="sticky bottom-0 -mx-4 mt-auto flex flex-col gap-3 border-t bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">
                {chosen.length} cheque{chosen.length === 1 ? '' : 's'}
              </span>
              <span className="text-lg font-semibold tabular-nums text-money-in">{formatSigned(total, 'in')}</span>
            </div>
            <p className="text-sm text-ink-quiet">
              They'll show as in clearing. After {clearingDays} day{clearingDays === 1 ? '' : 's'} Today asks whether they cleared.
            </p>
            <Button size="lg" disabled={!chosen.length || saving} onClick={() => void deposit()}>
              <Landmark />
              {saving ? 'Depositing…' : `Deposit ${chosen.length || ''} cheque${chosen.length === 1 ? '' : 's'}`.replace('  ', ' ')}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
