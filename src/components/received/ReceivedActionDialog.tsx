import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DateInput } from '@/components/ui/date-picker'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { accountLabel } from '@/lib/bankAccounts'
import { announceDataChange } from '@/lib/dataEvents'
import { currencySymbol, formatAmountInput, parseAmount, todayISO } from '@/lib/formatters'
import {
  bounceReceivedCheque,
  clearReceivedCheques,
  handBackReceivedCheque,
  redepositReceivedCheque,
  replaceReceivedCheque,
  settleReceivedCheque,
  writeOffReceivedCheque,
} from '@/lib/receivedCheques'
import { cn } from '@/lib/utils'
import { SETTLEMENT_METHOD_LABELS, type ReceivedCheque, type SettlementMethod } from '@/types/received'

export type ReceivedActionMode = 'clear' | 'bounce' | 'redeposit' | 'settle' | 'replace' | 'hand_back' | 'write_off'

const COPY: Record<ReceivedActionMode, { title: string; text: string; submit: string }> = {
  clear: { title: 'Mark it cleared', text: 'The money is in your account.', submit: 'Mark cleared' },
  bounce: { title: 'It bounced', text: 'The bank returned it unpaid. Say why, and what the bank charged you.', submit: 'Mark bounced' },
  redeposit: { title: 'Deposit it again', text: 'Deposit the same cheque again now, or keep it to deposit on a later date.', submit: 'Save' },
  settle: { title: 'Paid another way', text: 'They paid in cash or by transfer instead, so the cheque is settled.', submit: 'Mark settled' },
  replace: { title: 'Got a new cheque', text: 'They gave you a new cheque in its place. It starts in hand, linked to this one.', submit: 'Add the new cheque' },
  hand_back: { title: 'Hand it back', text: 'You gave the cheque back to them, for example when a lease ends.', submit: 'Hand it back' },
  write_off: { title: 'Write it off', text: "The money won't come. The cheque stays in your records.", submit: 'Write it off' },
}

const BOUNCE_REASONS = ['Funds insufficient', 'Signature differs', 'Payment stopped by the drawer', 'Account closed', 'Cheque out of date']
const NO_ACCOUNT = '__none__'

interface ReceivedActionDialogProps {
  mode: ReceivedActionMode | null
  cheque: ReceivedCheque | null
  onClose: () => void
  onDone?: () => void
}

/** One action on a received cheque, with the few details it needs. Each runs a SQL function that checks it. */
export function ReceivedActionDialog({ mode, cheque, onClose, onDone }: ReceivedActionDialogProps) {
  const { accounts, defaultAccount } = useBankAccounts()
  const [date, setDate] = useState(todayISO())
  const [reason, setReason] = useState('')
  const [charges, setCharges] = useState('')
  const [later, setLater] = useState(false)
  const [account, setAccount] = useState(NO_ACCOUNT)
  const [via, setVia] = useState<SettlementMethod>('TRANSFER')
  const [reference, setReference] = useState('')
  const [number, setNumber] = useState('')
  const [bank, setBank] = useState('')
  const [amount, setAmount] = useState('')
  const [chequeDate, setChequeDate] = useState(todayISO())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!mode || !cheque) return
    setDate(todayISO())
    setReason('')
    setCharges('')
    setLater(false)
    setAccount(cheque.deposit_account_id ?? defaultAccount?.id ?? NO_ACCOUNT)
    setVia('TRANSFER')
    setReference('')
    setNumber('')
    setBank(cheque.bank_name)
    setAmount(cheque.amount === null ? '' : formatAmountInput(String(cheque.amount)))
    setChequeDate(todayISO())
    // Only when the dialog opens for a cheque.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, cheque?.id])

  if (!mode || !cheque) return null
  const copy = COPY[mode]
  const accountId = account === NO_ACCOUNT ? undefined : account

  const valid =
    !!date &&
    (mode !== 'bounce' || reason.trim() !== '') &&
    (mode !== 'write_off' || reason.trim() !== '') &&
    (mode !== 'replace' || number.trim() !== '')

  const run = async () => {
    switch (mode) {
      case 'clear':
        return clearReceivedCheques([cheque.id], date)
      case 'bounce':
        return bounceReceivedCheque(cheque.id, {
          bouncedOn: date,
          reason: reason.trim(),
          bankCharges: charges ? parseAmount(charges) : undefined,
        })
      case 'redeposit':
        return redepositReceivedCheque(cheque.id, { date, depositNow: !later, accountId })
      case 'settle':
        return settleReceivedCheque(cheque.id, { via, settledOn: date, reference: reference.trim() || undefined })
      case 'replace':
        return replaceReceivedCheque(cheque.id, {
          chequeNumber: number.trim(),
          bankName: bank.trim() || cheque.bank_name,
          amount: amount ? parseAmount(amount) : cheque.amount,
          chequeDate,
          receivedOn: date,
        })
      case 'hand_back':
        return handBackReceivedCheque(cheque.id, reason.trim() || undefined)
      case 'write_off':
        return writeOffReceivedCheque(cheque.id, reason.trim())
    }
  }

  const submit = async () => {
    if (!valid) return
    setSaving(true)
    const result = await run()
    setSaving(false)
    if (!result.success) {
      toast.error(result.error ?? "Couldn't save that")
      return
    }
    toast.success(mode === 'redeposit' && later ? `Back in hand, to deposit on the date you chose` : `Done: ${copy.title.toLowerCase()}`)
    announceDataChange()
    onDone?.()
    onClose()
  }

  const dateLabel: Record<ReceivedActionMode, string> = {
    clear: 'Cleared on',
    bounce: 'Bounced on',
    redeposit: later ? 'Deposit it on' : 'Deposited on',
    settle: 'Paid on',
    replace: 'Received the new one on',
    hand_back: 'Handed back on',
    write_off: 'Written off on',
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.text}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          {mode === 'redeposit' && (
            <div role="group" aria-label="When" className="grid h-11 grid-cols-2 gap-1 rounded-xl bg-track p-1">
              {[false, true].map((isLater) => (
                <button
                  key={String(isLater)}
                  type="button"
                  aria-pressed={later === isLater}
                  onClick={() => setLater(isLater)}
                  className={cn('rounded-[9px] text-sm font-semibold', later === isLater ? 'bg-thumb text-ink shadow-thumb' : 'text-ink-quiet')}
                >
                  {isLater ? 'Later' : 'Now'}
                </button>
              ))}
            </div>
          )}

          {mode !== 'hand_back' && mode !== 'write_off' && (
            <div className="flex flex-col">
              <Label htmlFor="action-date">{dateLabel[mode]}</Label>
              <DateInput id="action-date" value={date} onChange={setDate} />
            </div>
          )}

          {mode === 'redeposit' && !later && (
            <div className="flex flex-col">
              <Label htmlFor="action-account">Into</Label>
              <Select value={account} onValueChange={setAccount}>
                <SelectTrigger id="action-account">
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
          )}

          {mode === 'bounce' && (
            <>
              <div className="flex flex-col">
                <Label htmlFor="action-reason">Why</Label>
                <Input id="action-reason" list="bounce-reasons" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
                <datalist id="bounce-reasons">
                  {BOUNCE_REASONS.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </div>
              <div className="flex flex-col">
                <Label htmlFor="action-charges">Bank charges (optional)</Label>
                <div className="flex h-12 items-center gap-2 rounded-lg border border-input bg-surface px-3.5 focus-within:ring-2 focus-within:ring-ring/40">
                  <span className="text-ink-quiet">{currencySymbol()}</span>
                  <input
                    id="action-charges"
                    inputMode="decimal"
                    className="min-w-0 flex-1 bg-transparent text-base tabular-nums outline-none"
                    value={charges}
                    onChange={(e) => setCharges(formatAmountInput(e.target.value))}
                  />
                </div>
              </div>
            </>
          )}

          {mode === 'settle' && (
            <>
              <div className="flex flex-col">
                <Label htmlFor="action-via">How they paid</Label>
                <Select value={via} onValueChange={(v) => setVia(v as SettlementMethod)}>
                  <SelectTrigger id="action-via">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SETTLEMENT_METHOD_LABELS) as SettlementMethod[]).map((m) => (
                      <SelectItem key={m} value={m}>
                        {SETTLEMENT_METHOD_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col">
                <Label htmlFor="action-reference">Reference (optional)</Label>
                <Input id="action-reference" placeholder="A transaction ID or receipt number" value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
            </>
          )}

          {mode === 'replace' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <Label htmlFor="action-number">New cheque no.</Label>
                  <Input id="action-number" inputMode="numeric" className="font-cheque" value={number} onChange={(e) => setNumber(e.target.value)} autoFocus />
                </div>
                <div className="flex flex-col">
                  <Label htmlFor="action-bank">Bank</Label>
                  <Input id="action-bank" value={bank} onChange={(e) => setBank(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <Label htmlFor="action-amount">Amount</Label>
                  <Input id="action-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(formatAmountInput(e.target.value))} />
                </div>
                <div className="flex flex-col">
                  <Label htmlFor="action-cheque-date">Cheque date</Label>
                  <DateInput id="action-cheque-date" value={chequeDate} onChange={setChequeDate} />
                </div>
              </div>
            </>
          )}

          {(mode === 'hand_back' || mode === 'write_off') && (
            <div className="flex flex-col">
              <Label htmlFor="action-why">{mode === 'write_off' ? 'Why' : 'Why (optional)'}</Label>
              <Textarea id="action-why" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={mode === 'write_off' ? 'destructive' : 'default'}
              disabled={!valid || saving}
            >
              {saving ? 'Saving…' : mode === 'redeposit' ? (later ? 'Keep it for later' : 'Deposit it again') : copy.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
