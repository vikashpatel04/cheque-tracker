import { useEffect, useMemo, useState } from 'react'
import { Repeat, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DateInput } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { PartyPicker } from '@/components/shared/PartyPicker'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { accountLabel } from '@/lib/bankAccounts'
import { announceDataChange } from '@/lib/dataEvents'
import { currencySymbol, formatAmountInput, formatMoney, formatShortDate, parseAmount, todayISO } from '@/lib/formatters'
import { createReceivedCheque, createReceivedSeries, updateReceivedCheque } from '@/lib/receivedCheques'
import { buildSeries, SERIES_MAX_CHEQUES, type SeriesInterval } from '@/lib/receivedSchedule'
import { cn } from '@/lib/utils'
import type { ReceivedCheque, ReceivedKind } from '@/types/received'

const NO_ACCOUNT = '__later__'
const EVERY: { value: SeriesInterval; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
]

interface ReceivedChequeFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Edit this cheque; otherwise add a new one. */
  cheque?: ReceivedCheque | null
  /** Start as a series (New → Series). */
  asSeries?: boolean
  /** The "I received it / I gave it" switch, when adding. */
  directionSwitch?: React.ReactNode
  /** Start with this party, e.g. when adding from their page. */
  partyId?: string
}

interface Draft {
  party_id: string
  kind: ReceivedKind
  amount: string
  cheque_number: string
  bank_name: string
  cheque_date: string
  due_date: string
  /** The deposit date follows the cheque date until it's changed by hand. */
  dueTouched: boolean
  received_on: string
  account: string
  notes: string
  series: boolean
  every: SeriesInterval
  count: string
}

function blank(defaultAccount: string | null, asSeries: boolean): Draft {
  const today = todayISO()
  return {
    party_id: '',
    kind: 'REGULAR',
    amount: '',
    cheque_number: '',
    bank_name: '',
    cheque_date: today,
    due_date: today,
    dueTouched: false,
    received_on: today,
    account: defaultAccount ?? NO_ACCOUNT,
    notes: '',
    series: asSeries,
    every: 'month',
    count: '12',
  }
}

/** Add or edit a cheque you received: one, a security cheque, or a whole series (design screen 35). */
export function ReceivedChequeForm({ open, onOpenChange, cheque, asSeries = false, directionSwitch, partyId }: ReceivedChequeFormProps) {
  const { accounts, defaultAccount } = useBankAccounts()
  const [draft, setDraft] = useState<Draft>(() => blank(null, asSeries))
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTried(false)
    if (cheque) {
      setDraft({
        party_id: cheque.party_id,
        kind: cheque.kind,
        amount: cheque.amount === null ? '' : formatAmountInput(String(cheque.amount)),
        cheque_number: cheque.cheque_number,
        bank_name: cheque.bank_name,
        cheque_date: cheque.cheque_date ?? '',
        due_date: cheque.due_date,
        dueTouched: true,
        received_on: cheque.received_on,
        account: cheque.deposit_account_id ?? NO_ACCOUNT,
        notes: cheque.notes ?? '',
        series: false,
        every: 'month',
        count: '12',
      })
    } else {
      setDraft({ ...blank(defaultAccount?.id ?? null, asSeries), party_id: partyId ?? '' })
    }
    // Only when the form opens; the default account can load a moment later.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cheque, asSeries, partyId])

  useEffect(() => {
    if (open && !cheque && defaultAccount && draft.account === NO_ACCOUNT) {
      setDraft((d) => ({ ...d, account: defaultAccount.id }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultAccount?.id, open])

  const set = (changes: Partial<Draft>) => setDraft((d) => ({ ...d, ...changes }))
  const security = draft.kind === 'SECURITY'
  const amount = parseAmount(draft.amount)
  const count = Number(draft.count)

  const series = useMemo(() => {
    if (!draft.series || cheque) return null
    try {
      return { cheques: buildSeries({ firstNumber: draft.cheque_number, firstDate: draft.cheque_date, count, every: draft.every }), error: null }
    } catch (e) {
      return { cheques: [], error: (e as Error).message }
    }
  }, [draft.series, draft.cheque_number, draft.cheque_date, count, draft.every, cheque])

  const errors = {
    party: !draft.party_id ? 'Choose who gave it to you' : undefined,
    number: !draft.cheque_number.trim() ? 'The cheque number is needed' : undefined,
    bank: !draft.bank_name.trim() ? 'The bank it is drawn on is needed' : undefined,
    amount: !security && !(amount > 0) ? 'The amount is needed' : undefined,
    chequeDate: !security && !draft.cheque_date ? 'The date on the cheque is needed' : undefined,
    due: !draft.due_date ? (security ? 'When to review it is needed' : 'When to deposit it is needed') : undefined,
    series:
      series && (series.error || series.cheques.some((c) => !c.cheque_number))
        ? series.error ?? 'The first number needs digits to count up from'
        : undefined,
  }
  const valid = !Object.values(errors).some(Boolean)

  const save = async () => {
    setTried(true)
    if (!valid) return
    setSaving(true)
    const fields = {
      party_id: draft.party_id,
      kind: draft.kind,
      cheque_number: draft.cheque_number.trim(),
      bank_name: draft.bank_name.trim(),
      amount: security && !draft.amount ? null : amount,
      received_on: draft.received_on || todayISO(),
      cheque_date: draft.cheque_date || null,
      due_date: draft.due_date,
      deposit_account_id: draft.account === NO_ACCOUNT ? null : draft.account,
      notes: draft.notes.trim() || null,
    }
    let result: { success: boolean; error?: string }
    let message: string
    if (cheque) {
      result = await updateReceivedCheque(cheque.id, fields)
      message = 'Cheque saved'
    } else if (series) {
      const base = {
        party_id: fields.party_id,
        kind: fields.kind,
        bank_name: fields.bank_name,
        amount: fields.amount,
        received_on: fields.received_on,
        deposit_account_id: fields.deposit_account_id,
        notes: fields.notes,
      }
      result = await createReceivedSeries(base, { firstNumber: fields.cheque_number, firstDate: draft.cheque_date, count, every: draft.every })
      message = `${count} cheques added`
    } else {
      result = await createReceivedCheque(fields)
      message = 'Cheque added'
    }
    setSaving(false)
    if (!result.success) {
      toast.error(`Couldn't save: ${result.error}`)
      return
    }
    toast.success(message)
    announceDataChange()
    onOpenChange(false)
  }

  const show = (error?: string) => (tried && error ? <p className="mt-1 text-sm text-problem">{error}</p> : null)
  const total = series && amount > 0 ? amount * series.cheques.length : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto bg-background p-0 sm:max-w-[520px] [&>button:last-child]:hidden">
        <div className="sticky top-0 z-10 flex h-[60px] shrink-0 items-center gap-1 border-b bg-background/95 px-2 backdrop-blur">
          <Button variant="ghost" size="icon" aria-label="Close" onClick={() => onOpenChange(false)}>
            <X />
          </Button>
          <SheetTitle className="text-lg font-semibold">{cheque ? 'Edit cheque' : draft.series ? 'New series' : 'New cheque'}</SheetTitle>
          <SheetDescription className="sr-only">A cheque someone gave you.</SheetDescription>
        </div>

        <form
          className="flex flex-1 flex-col gap-[18px] px-4 pt-[18px]"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          {!cheque && directionSwitch}

          <PartyPicker id="received-party" label="From" value={draft.party_id} onChange={(party_id) => set({ party_id })} error={tried ? errors.party : undefined} />

          <div className="flex flex-col">
            <Label htmlFor="received-amount">Amount{security ? ' (optional for a security cheque)' : ''}</Label>
            <div className="flex h-14 items-center gap-2 rounded-lg border-2 border-brand bg-surface px-3.5 focus-within:ring-2 focus-within:ring-ring/40">
              <span className="text-xl text-ink-quiet">{currencySymbol()}</span>
              <input
                id="received-amount"
                inputMode="decimal"
                className="min-w-0 flex-1 bg-transparent text-[22px] font-semibold tabular-nums outline-none"
                value={draft.amount}
                onChange={(e) => set({ amount: formatAmountInput(e.target.value) })}
              />
            </div>
            {show(errors.amount)}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <Label htmlFor="received-number">{draft.series ? 'First cheque no.' : 'Cheque no.'}</Label>
              <Input
                id="received-number"
                inputMode="numeric"
                className="font-cheque"
                value={draft.cheque_number}
                onChange={(e) => set({ cheque_number: e.target.value })}
              />
              {show(errors.number)}
            </div>
            <div className="flex flex-col">
              <Label htmlFor="received-bank">Bank</Label>
              <Input id="received-bank" value={draft.bank_name} onChange={(e) => set({ bank_name: e.target.value })} />
              {show(errors.bank)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <Label htmlFor="received-date">{draft.series ? 'First cheque date' : 'Cheque date'}</Label>
              <DateInput
                id="received-date"
                value={draft.cheque_date}
                onChange={(cheque_date) => set(draft.dueTouched ? { cheque_date } : { cheque_date, due_date: cheque_date })}
              />
              {show(errors.chequeDate)}
            </div>
            <div className="flex flex-col">
              <Label htmlFor="received-due">{security ? 'Review on' : 'Deposit on'}</Label>
              <DateInput
                id="received-due"
                value={draft.due_date}
                disabled={draft.series}
                onChange={(due_date) => set({ due_date, dueTouched: true })}
              />
              {show(errors.due)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <Label htmlFor="received-on">Received on</Label>
              <DateInput id="received-on" value={draft.received_on} onChange={(received_on) => set({ received_on })} />
            </div>
            <div className="flex flex-col">
              <span className="mb-1.5 text-sm font-medium">Kind</span>
              <div role="group" aria-label="Kind" className="grid h-12 grid-cols-2 gap-1 rounded-lg bg-track p-1">
                {(['REGULAR', 'SECURITY'] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    aria-pressed={draft.kind === kind}
                    onClick={() => set({ kind, series: kind === 'SECURITY' ? false : draft.series })}
                    className={cn(
                      'rounded-[7px] text-sm font-semibold',
                      draft.kind === kind ? 'bg-thumb text-ink shadow-thumb' : 'text-ink-quiet'
                    )}
                  >
                    {kind === 'REGULAR' ? 'Regular' : 'Security'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col">
            <Label htmlFor="received-account">Deposit into</Label>
            <Select value={draft.account} onValueChange={(account) => set({ account })}>
              <SelectTrigger id="received-account">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ACCOUNT}>Choose when depositing</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {accountLabel(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {accounts.length === 0 && (
              <p className="mt-1 text-[13px] text-ink-quiet">Add your bank accounts in Settings to choose one here.</p>
            )}
          </div>

          {!cheque && !security && (
            <section className={cn('flex flex-col gap-3 rounded-xl border bg-surface p-4', draft.series && 'border-brand')}>
              <label className="flex items-center justify-between gap-3">
                <span className="flex items-start gap-3">
                  <Repeat className="mt-0.5 h-5 w-5 shrink-0 text-ink-quiet" aria-hidden="true" />
                  <span className="flex flex-col">
                    <span className="font-semibold">One of a series</span>
                    <span className="text-sm text-ink-quiet">Rent, instalments: add them all at once</span>
                  </span>
                </span>
                <Switch checked={draft.series} onCheckedChange={(on) => set({ series: on })} />
              </label>
              {draft.series && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col">
                      <Label htmlFor="series-every">Every</Label>
                      <Select value={draft.every} onValueChange={(every) => set({ every: every as SeriesInterval })}>
                        <SelectTrigger id="series-every">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EVERY.map((e) => (
                            <SelectItem key={e.value} value={e.value}>
                              {e.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col">
                      <Label htmlFor="series-count">How many</Label>
                      <Input
                        id="series-count"
                        inputMode="numeric"
                        value={draft.count}
                        onChange={(e) => set({ count: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                      />
                    </div>
                  </div>
                  {series && series.cheques.length > 0 && !errors.series && (
                    <p className="flex flex-wrap justify-between gap-2 rounded-lg bg-track px-3 py-2.5 text-sm">
                      <span>
                        {series.cheques.length} cheques, <span className="font-cheque">{series.cheques[0].cheque_number}</span> to{' '}
                        <span className="font-cheque">{series.cheques[series.cheques.length - 1].cheque_number}</span>, until{' '}
                        {formatShortDate(series.cheques[series.cheques.length - 1].cheque_date)}
                      </span>
                      {total !== null && <span className="font-semibold tabular-nums text-money-in">+{formatMoney(total)}</span>}
                    </p>
                  )}
                  {tried && errors.series && <p className="text-sm text-problem">{errors.series}</p>}
                  {count > SERIES_MAX_CHEQUES && <p className="text-sm text-problem">A series has at most {SERIES_MAX_CHEQUES} cheques.</p>}
                </>
              )}
            </section>
          )}

          <div className="flex flex-col">
            <Label htmlFor="received-notes">
              Note <span className="font-normal text-ink-quiet">(optional)</span>
            </Label>
            <Textarea id="received-notes" rows={2} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
          </div>

          <div className="sticky bottom-0 -mx-4 mt-auto border-t bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
            <Button type="submit" size="lg" className="w-full" disabled={saving}>
              {saving
                ? 'Saving…'
                : cheque
                  ? 'Save'
                  : series && series.cheques.length
                    ? `Add ${series.cheques.length} cheques`
                    : 'Add cheque'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
