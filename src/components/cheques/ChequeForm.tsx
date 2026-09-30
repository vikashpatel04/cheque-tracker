import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { DateInput } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { PartyPicker } from '@/components/shared/PartyPicker'
import { describeExisting, loadRecentChequeNumbers, useExistingChequeNumbers } from '@/hooks/useExistingChequeNumbers'
import { AccountPicker } from '@/components/shared/AccountPicker'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { inChequeBook, suggestChequeNumber, type NumberedCheque } from '@/lib/chequeNumbers'
import { currencySymbol, formatAmountInput, parseAmount, todayISO } from '@/lib/formatters'
import { updateChequeStatus } from '@/lib/updateChequeStatus'
import { cn } from '@/lib/utils'
import { VALID_STATUS_TRANSITIONS, type Cheque, type ChequeStatus } from '@/types'
import { STATUS_ACTION_META } from './StatusActions'

const chequeSchema = z.object({
  party_id: z.string().min(1, 'Choose who the cheque is to'),
  cheque_number: z.string().min(1, 'The cheque number is needed'),
  bank_name: z.string().min(1, 'Choose the account it is drawn on'),
  bank_account_id: z.string().nullable().optional(),
  amount: z.coerce.number().positive('The amount is needed'),
  issue_date: z.string().min(1),
  due_date: z.string().min(1),
  notes: z.string().optional(),
})

type ChequeFormData = z.infer<typeof chequeSchema>

interface ChequeFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cheque?: Cheque | null
  prefill?: Partial<ChequeFormData>
  /** Return false when saving failed (caller shows the error) to keep the form open. */
  onSubmit: (data: ChequeFormData) => Promise<boolean | void>
  onStatusChange?: () => void
  /** Set when issuing a new cheque in place of a written-off one (shown as a note). */
  replacing?: Pick<Cheque, 'cheque_number' | 'write_off_reason'> | null
  /** The "I received it / I gave it" switch, when adding. */
  directionSwitch?: React.ReactNode
}

/** Add or edit a cheque you gave (design screen 35). */
export function ChequeForm({ open, onOpenChange, cheque, prefill, onSubmit, onStatusChange, replacing, directionSwitch }: ChequeFormProps) {
  const { defaultAccount } = useBankAccounts()
  const [newStatus, setNewStatus] = useState<ChequeStatus | ''>('')
  const [returnReason, setReturnReason] = useState('')
  const [amountDisplay, setAmountDisplay] = useState('')
  // Your latest cheques' numbers, and the number last suggested from them.
  const [recent, setRecent] = useState<NumberedCheque[] | null>(null)
  const suggested = useRef('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    getValues,
    watch,
    reset,
  } = useForm<ChequeFormData>({
    resolver: zodResolver(chequeSchema),
    defaultValues: { issue_date: todayISO(), due_date: todayISO() },
  })

  useEffect(() => {
    if (!open) {
      setNewStatus('')
      setReturnReason('')
      setAmountDisplay('')
      return
    }
    if (cheque) {
      reset({
        party_id: cheque.party_id,
        cheque_number: cheque.cheque_number,
        bank_name: cheque.bank_name,
        bank_account_id: cheque.bank_account_id ?? null,
        amount: Number(cheque.amount),
        issue_date: cheque.issue_date,
        due_date: cheque.due_date,
        notes: cheque.notes ?? '',
      })
      setAmountDisplay(formatAmountInput(String(cheque.amount)))
    } else {
      reset(prefill ? { issue_date: todayISO(), due_date: todayISO(), ...prefill } : { issue_date: todayISO(), due_date: todayISO() })
      setAmountDisplay(prefill?.amount != null ? formatAmountInput(String(prefill.amount)) : '')

      // The number is suggested from the chosen account's cheque book, below.
      suggested.current = ''
      setRecent(null)
      if (!prefill?.cheque_number) {
        let cancelled = false
        void loadRecentChequeNumbers().then((numbers) => !cancelled && setRecent(numbers))
        return () => {
          cancelled = true
        }
      }
    }
  }, [open, cheque, prefill, reset])

  // A new cheque starts on your default account, once your accounts have loaded.
  const bankName = watch('bank_name')
  useEffect(() => {
    if (open && !cheque && !bankName && defaultAccount) {
      setValue('bank_account_id', defaultAccount.id)
      setValue('bank_name', defaultAccount.bank_name)
    }
  }, [open, cheque, bankName, defaultAccount, setValue])

  // Suggest the next number in the chosen account's cheque book (plan item 81),
  // and again when you switch account, unless you've typed your own.
  const accountId = watch('bank_account_id') ?? null
  const defaultAccountId = defaultAccount?.id ?? null
  useEffect(() => {
    if (!open || cheque || !recent) return
    const typed = getValues('cheque_number')
    if (typed && typed !== suggested.current) return
    const next = suggestChequeNumber(recent, accountId, defaultAccountId)
    suggested.current = next
    setValue('cheque_number', next)
  }, [open, cheque, recent, accountId, defaultAccountId, getValues, setValue])

  const partyId = watch('party_id')
  const chequeNumber = watch('cheque_number') ?? ''
  const existingNumbers = useExistingChequeNumbers(open ? [chequeNumber] : [], cheque?.id)
  // Another account's cheque book can have the same number.
  const duplicateWarning = describeExisting(
    existingNumbers.get(chequeNumber.trim())?.filter((c) => inChequeBook(c, accountId, defaultAccountId))
  )
  const validTransitions = cheque ? VALID_STATUS_TRANSITIONS[cheque.status] : []

  const handleFormSubmit = async (data: ChequeFormData) => {
    const statusChanging = cheque && newStatus && newStatus !== cheque.status
    if (statusChanging && newStatus === 'RETURNED' && !returnReason.trim()) return

    // Save the field edits first so a failed save never leaves a half-applied
    // status change behind.
    const saved = await onSubmit(data)
    if (saved === false) return

    if (cheque && statusChanging) {
      const result = await updateChequeStatus(cheque.id, newStatus, {
        changedBy: 'manual',
        returnReason: newStatus === 'RETURNED' ? returnReason : undefined,
      })
      if (!result.success) {
        toast.error(`Cheque saved, but the status change failed: ${result.error ?? 'unknown error'}`)
        return
      }
      onStatusChange?.()
    }
    onOpenChange(false)
  }

  const error = (message?: string) => (message ? <p className="mt-1 text-sm text-problem">{message}</p> : null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto bg-background p-0 sm:max-w-[520px] [&>button:last-child]:hidden">
        <div className="sticky top-0 z-10 flex h-[60px] shrink-0 items-center gap-1 border-b bg-background/95 px-2 backdrop-blur">
          <Button variant="ghost" size="icon" aria-label="Close" onClick={() => onOpenChange(false)}>
            <X />
          </Button>
          <SheetTitle className="text-lg font-semibold">{cheque ? 'Edit cheque' : 'New cheque'}</SheetTitle>
          <SheetDescription className="sr-only">A cheque you gave to someone.</SheetDescription>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-1 flex-col gap-[18px] px-4 pt-[18px]">
          {!cheque && directionSwitch}

          {!cheque && replacing && (
            <div className="rounded-xl border bg-surface p-3.5 text-sm">
              A new cheque in place of written-off cheque <span className="font-cheque font-medium">{replacing.cheque_number}</span>
              {replacing.write_off_reason && <span className="text-ink-quiet"> ({replacing.write_off_reason})</span>}. It's
              filled in from that one: add the new number and dates.
            </div>
          )}

          <PartyPicker
            id="given-party"
            label="To"
            value={partyId ?? ''}
            onChange={(v) => setValue('party_id', v, { shouldValidate: true })}
            error={errors.party_id?.message}
          />

          <div className="flex flex-col">
            <Label htmlFor="given-amount">Amount</Label>
            <div className="flex h-14 items-center gap-2 rounded-lg border-2 border-brand bg-surface px-3.5 focus-within:ring-2 focus-within:ring-ring/40">
              <span className="text-xl text-ink-quiet">{currencySymbol()}</span>
              <input
                id="given-amount"
                inputMode="decimal"
                placeholder="0"
                className="min-w-0 flex-1 bg-transparent text-[22px] font-semibold tabular-nums outline-none"
                value={amountDisplay}
                onChange={(e) => {
                  const formatted = formatAmountInput(e.target.value)
                  setAmountDisplay(formatted)
                  setValue('amount', parseAmount(formatted), { shouldValidate: true })
                }}
              />
            </div>
            {error(errors.amount?.message)}
          </div>

          <AccountPicker
            id="given-bank"
            value={{ accountId: watch('bank_account_id') ?? null, bankName: watch('bank_name') ?? '' }}
            onChange={(v) => {
              setValue('bank_account_id', v.accountId)
              setValue('bank_name', v.bankName, { shouldValidate: true })
            }}
            error={errors.bank_name?.message}
          />

          <div className="flex flex-col">
            <Label htmlFor="given-number">Cheque no.</Label>
            <Input id="given-number" inputMode="numeric" className="font-cheque" {...register('cheque_number')} />
            {error(errors.cheque_number?.message)}
            {!errors.cheque_number && duplicateWarning && <p className="mt-1 text-xs text-attention">{duplicateWarning}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <Label htmlFor="given-issued">Issued on</Label>
              <DateInput id="given-issued" value={watch('issue_date')} onChange={(v) => setValue('issue_date', v, { shouldValidate: true })} />
            </div>
            <div className="flex flex-col">
              <Label htmlFor="given-due">Due on</Label>
              <DateInput id="given-due" value={watch('due_date')} onChange={(v) => setValue('due_date', v, { shouldValidate: true })} />
            </div>
          </div>

          <div className="flex flex-col">
            <Label htmlFor="given-notes">
              Note <span className="font-normal text-ink-quiet">(optional)</span>
            </Label>
            <Textarea id="given-notes" rows={2} {...register('notes')} />
          </div>

          {cheque && validTransitions.length > 0 && (
            <section className="flex flex-col gap-2 rounded-xl border bg-surface p-4">
              <span className="font-semibold">Change the status too</span>
              <span className="text-sm text-ink-quiet">
                Applied when you save. It's {STATUS_ACTION_META[cheque.status].label.toLowerCase()} now.
              </span>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant={newStatus === '' ? 'default' : 'outline'} onClick={() => setNewStatus('')}>
                  Keep it
                </Button>
                {validTransitions.map((s) => {
                  const { label, Icon } = STATUS_ACTION_META[s]
                  return (
                    <Button
                      key={s}
                      type="button"
                      size="sm"
                      variant={newStatus === s ? 'default' : 'outline'}
                      onClick={() => setNewStatus(s)}
                      className={cn(newStatus !== s && s === 'RETURNED' && 'text-problem')}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Button>
                  )
                })}
              </div>
              {newStatus === 'RETURNED' && (
                <div className="mt-1 flex flex-col">
                  <Label htmlFor="given-return-reason">Why it came back</Label>
                  <Textarea id="given-return-reason" value={returnReason} onChange={(e) => setReturnReason(e.target.value)} required />
                </div>
              )}
            </section>
          )}

          <div className="sticky bottom-0 -mx-4 mt-auto border-t bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : cheque ? 'Save' : 'Add cheque'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
