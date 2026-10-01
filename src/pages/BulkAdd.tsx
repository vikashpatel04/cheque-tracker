import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Combobox } from '@/components/ui/combobox'
import { DateInput } from '@/components/ui/date-picker'
import { AccountPicker } from '@/components/shared/AccountPicker'
import { PageHeader } from '@/components/shared/PageHeader'
import { describeExisting, loadRecentChequeNumbers, useExistingChequeNumbers } from '@/hooks/useExistingChequeNumbers'
import { useParties } from '@/hooks/useParties'
import { usePlan } from '@/hooks/usePlan'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { inChequeBook, nextFreeNumber, numbersInBook, suggestChequeNumber, type NumberedCheque } from '@/lib/chequeNumbers'
import { currencySymbol, formatAmountInput, formatMoney, parseAmount, todayISO } from '@/lib/formatters'
import { supabase } from '@/lib/supabase'

interface BulkRow {
  id: string
  party_id: string
  cheque_number: string
  bank_name: string
  bank_account_id: string | null
  amount: string
  issue_date: string
  due_date: string
  notes: string
  /** The number was suggested, not typed, so it follows the row's account. */
  numberSuggested: boolean
}

/**
 * The number for row `index` on an account (plan item 81): after the nearest
 * row above it on that account, or else the next in that account's cheque
 * book, skipping numbers the book or the other rows use.
 */
function numberFor(
  rows: BulkRow[],
  index: number,
  accountId: string | null,
  recent: NumberedCheque[],
  defaultAccountId: string | null
): string {
  const others = rows.filter((r, i) => i !== index && r.bank_account_id === accountId).map((r) => r.cheque_number.trim())
  const above = rows.slice(0, index).filter((r) => r.bank_account_id === accountId && r.cheque_number.trim()).at(-1)
  if (!above) return suggestChequeNumber(recent, accountId, defaultAccountId, others)
  return nextFreeNumber(above.cheque_number, new Set([...numbersInBook(recent, accountId, defaultAccountId), ...others]))
}

const plural = (n: number) => `${n} cheque${n === 1 ? '' : 's'}`

/**
 * Several given cheques at once (New → Several given cheques, or from a
 * party's ledger for that party). One card per cheque; all are saved together
 * or none are.
 */
export default function BulkAdd() {
  const navigate = useNavigate()
  const { requireWrite } = usePlan()
  const { partyId } = useParams<{ partyId: string }>()
  const isPartyWise = Boolean(partyId)

  const { parties } = useParties()
  // New rows start on your default account's bank.
  const { defaultAccount } = useBankAccounts()
  const defaultBank = defaultAccount?.bank_name ?? ''
  const defaultAccountId = defaultAccount?.id ?? null

  const [rows, setRows] = useState<BulkRow[]>([])
  const [loading, setLoading] = useState(false)
  // After a save with details missing, each row says what it still needs.
  const [attempted, setAttempted] = useState(false)
  // Your latest cheques' numbers, to suggest each row's number from its account's cheque book.
  const [recent, setRecent] = useState<NumberedCheque[] | null>(null)

  const partyOptions = parties.map((p) => ({ value: p.id, label: p.name }))

  useEffect(() => {
    let cancelled = false
    void loadRecentChequeNumbers().then((numbers) => !cancelled && setRecent(numbers))
    return () => {
      cancelled = true
    }
  }, [])

  /** A new row continues the one above it: the same account and its next number. */
  const makeRow = (existing: BulkRow[], numbers: NumberedCheque[]): BulkRow => {
    const last = existing.at(-1)
    const row: BulkRow = {
      id: crypto.randomUUID(),
      party_id: isPartyWise ? partyId! : '',
      cheque_number: '',
      bank_name: last ? last.bank_name : defaultBank,
      bank_account_id: last ? last.bank_account_id : defaultAccountId,
      amount: '',
      issue_date: todayISO(),
      due_date: todayISO(),
      notes: '',
      numberSuggested: true,
    }
    const all = [...existing, row]
    return { ...row, cheque_number: numberFor(all, existing.length, row.bank_account_id, numbers, defaultAccountId) }
  }

  // The first row, once your latest numbers have loaded.
  useEffect(() => {
    if (recent) setRows((prev) => (prev.length > 0 ? prev : [makeRow([], recent)]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recent])

  // Once your accounts have loaded, rows without a bank start on your default account.
  useEffect(() => {
    if (!defaultBank) return
    setRows((prev) =>
      prev.map((r, i) =>
        r.bank_name
          ? r
          : {
              ...r,
              bank_name: defaultBank,
              bank_account_id: defaultAccountId,
              cheque_number: r.numberSuggested ? numberFor(prev, i, defaultAccountId, recent ?? [], defaultAccountId) : r.cheque_number,
            }
      )
    )
  }, [defaultBank, defaultAccountId, recent])

  const handleAddRow = () => {
    setRows((prev) => [...prev, makeRow(prev, recent ?? [])])
  }

  /** Choosing another account renumbers the row, unless you typed its number. */
  const changeAccount = (id: string, accountId: string | null, bankName: string) => {
    setRows((prev) =>
      prev.map((r, i) =>
        r.id !== id
          ? r
          : {
              ...r,
              bank_account_id: accountId,
              bank_name: bankName,
              cheque_number: r.numberSuggested ? numberFor(prev, i, accountId, recent ?? [], defaultAccountId) : r.cheque_number,
            }
      )
    )
  }

  const updateRow = (id: string, field: 'party_id' | 'cheque_number' | 'amount' | 'issue_date' | 'due_date', value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        if (field === 'amount') return { ...r, amount: formatAmountInput(value) }
        if (field === 'cheque_number') return { ...r, cheque_number: value, numberSuggested: false }
        return { ...r, [field]: value }
      })
    )
  }

  const removeRow = (id: string) => {
    if (rows.length === 1) return
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  /** What a row still needs before it can be saved. */
  const missing = (r: BulkRow): string[] =>
    [
      !r.party_id && 'the party',
      !r.bank_name && 'the account',
      !r.cheque_number.trim() && 'the number',
      !parseAmount(r.amount) && 'the amount',
      (!r.issue_date || !r.due_date) && 'the dates',
    ].filter((m): m is string => Boolean(m))

  const handleSubmit = async () => {
    if (!requireWrite()) return
    if (rows.some((r) => missing(r).length > 0)) {
      setAttempted(true)
      toast.error('Some cheques still need details. Each one says what.')
      return
    }

    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      toast.error("You're signed out. Sign in again, then save.")
      return
    }

    // Insert all rows in one request: either every cheque is saved or none
    // are, so a failure never leaves the user unsure which rows made it in.
    const { error } = await supabase.from('cheques').insert(
      rows.map((row) => ({
        user_id: user.id,
        status: 'PENDING',
        party_id: row.party_id,
        cheque_number: row.cheque_number.trim(),
        bank_name: row.bank_name,
        bank_account_id: row.bank_account_id,
        amount: parseAmount(row.amount),
        issue_date: row.issue_date,
        due_date: row.due_date,
        notes: row.notes || null,
      }))
    )
    setLoading(false)

    if (error) {
      toast.error(`Nothing was saved: ${error.message}. Your cheques are still here to fix and save again.`)
      return
    }
    toast.success(`Added ${plural(rows.length)}`)
    navigate('/cheques')
  }

  const selectedParty = parties.find((p) => p.id === partyId)
  const existingNumbers = useExistingChequeNumbers(rows.map((r) => r.cheque_number))
  // Two accounts' cheque books can share a number, so repeats count per account.
  const bookKey = (r: BulkRow) => `${r.bank_account_id ?? ''}|${r.cheque_number.trim()}`
  const rowNumberCounts = rows.reduce((m, r) => {
    if (r.cheque_number.trim()) m.set(bookKey(r), (m.get(bookKey(r)) ?? 0) + 1)
    return m
  }, new Map<string, number>())
  const total = rows.reduce((sum, r) => sum + parseAmount(r.amount), 0)

  return (
    <div className="flex flex-col">
      <PageHeader
        back={() => navigate(-1)}
        title="Several given cheques"
        subtitle={
          <>
            {isPartyWise && selectedParty && (
              <>
                To <strong className="font-semibold text-ink">{selectedParty.name}</strong>.{' '}
              </>
            )}
            A new cheque continues the account and number of the one above.
          </>
        }
      />

      <div className="flex flex-col gap-3">
        {rows.map((row, index) => {
          const n = row.cheque_number.trim()
          const warning =
            (rowNumberCounts.get(bookKey(row)) ?? 0) > 1
              ? 'Repeated in another cheque here'
              : describeExisting(existingNumbers.get(n)?.filter((c) => inChequeBook(c, row.bank_account_id, defaultAccountId)))
          const needs = attempted ? missing(row) : []
          return (
            <section key={row.id} aria-label={`Cheque ${index + 1}`} className="rounded-xl border bg-surface p-4">
              <div className="-mt-1 mb-2 flex items-center justify-between">
                <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-ink-quiet">Cheque {index + 1}</h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="-mr-2 h-10 w-10 text-ink-quiet hover:text-problem"
                  aria-label={`Remove cheque ${index + 1}`}
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length === 1}
                >
                  <Trash2 />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-4 lg:grid-cols-3">
                {!isPartyWise && (
                  <div className="col-span-2 flex flex-col lg:col-span-1">
                    <Label htmlFor={`party-${row.id}`}>To</Label>
                    <Combobox
                      id={`party-${row.id}`}
                      options={partyOptions}
                      value={row.party_id}
                      onChange={(v) => updateRow(row.id, 'party_id', v)}
                      placeholder="Choose a party"
                      title="Choose a party"
                      searchPlaceholder="Type a name"
                      emptyText="No party by that name. Add parties from Parties."
                    />
                  </div>
                )}

                <div className="col-span-2 lg:col-span-1">
                  <AccountPicker
                    id={`bank-${row.id}`}
                    value={{ accountId: row.bank_account_id, bankName: row.bank_name }}
                    onChange={(v) => changeAccount(row.id, v.accountId, v.bankName)}
                  />
                </div>

                <div className="flex flex-col">
                  <Label htmlFor={`number-${row.id}`}>Cheque no.</Label>
                  <Input
                    id={`number-${row.id}`}
                    inputMode="numeric"
                    className="font-cheque"
                    value={row.cheque_number}
                    onChange={(e) => updateRow(row.id, 'cheque_number', e.target.value)}
                  />
                  {warning && <p className="mt-1 text-[13px] text-attention">{warning}</p>}
                </div>

                <div className="flex flex-col">
                  <Label htmlFor={`amount-${row.id}`}>Amount</Label>
                  <div className="flex h-12 items-center gap-2 rounded-lg border border-input bg-surface px-3.5 focus-within:ring-2 focus-within:ring-ring/40">
                    <span className="text-ink-quiet">{currencySymbol()}</span>
                    <input
                      id={`amount-${row.id}`}
                      inputMode="decimal"
                      placeholder="0"
                      className="min-w-0 flex-1 bg-transparent text-base font-semibold tabular-nums outline-none"
                      value={row.amount}
                      onChange={(e) => updateRow(row.id, 'amount', e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-col">
                  <Label htmlFor={`issued-${row.id}`}>Issued on</Label>
                  <DateInput id={`issued-${row.id}`} value={row.issue_date} onChange={(v) => updateRow(row.id, 'issue_date', v)} />
                </div>

                <div className="flex flex-col">
                  <Label htmlFor={`due-${row.id}`}>Due on</Label>
                  <DateInput id={`due-${row.id}`} value={row.due_date} onChange={(v) => updateRow(row.id, 'due_date', v)} />
                </div>
              </div>

              {needs.length > 0 && <p className="mt-3 text-sm text-problem">Still needed: {needs.join(', ')}.</p>}
            </section>
          )
        })}
      </div>

      <div className="sticky bottom-[calc(84px+env(safe-area-inset-bottom))] z-20 mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 rounded-xl border bg-surface px-4 py-3 shadow-pop lg:bottom-6">
        <p className="text-[15px] text-ink-quiet">
          <span className="font-semibold text-ink">{plural(rows.length)}</span> ·{' '}
          <span className="font-semibold tabular-nums text-ink">{formatMoney(total)}</span>
        </p>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button variant="outline" className="flex-1 sm:flex-none" onClick={handleAddRow} disabled={!recent}>
            <Plus />
            Add another
          </Button>
          <Button className="flex-1 sm:flex-none" onClick={() => void handleSubmit()} disabled={loading || rows.length === 0}>
            {loading ? 'Saving…' : `Save ${plural(rows.length)}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
