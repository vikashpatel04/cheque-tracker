import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import { AccountPicker } from '@/components/shared/AccountPicker'
import { DateInput } from '@/components/ui/date-picker'
import { useExistingChequeNumbers, describeExisting } from '@/hooks/useExistingChequeNumbers'
import { useParties } from '@/hooks/useParties'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { todayISO, formatAmountInput, parseAmount, nextChequeNumber } from '@/lib/formatters'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/PageHeader'

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
}

export default function BulkAdd() {
  const navigate = useNavigate()
  const { partyId } = useParams<{ partyId: string }>()
  const isPartyWise = Boolean(partyId)

  const { parties } = useParties()
  // New rows start on your default account's bank.
  const { defaultAccount } = useBankAccounts()
  const defaultBank = defaultAccount?.bank_name ?? ''
  const defaultAccountId = defaultAccount?.id ?? null

  const [rows, setRows] = useState<BulkRow[]>([])
  const [loading, setLoading] = useState(false)

  const partyOptions = parties.map((p) => ({ value: p.id, label: p.name }))

  useEffect(() => {
    // Fetch last cheque number from DB to seed the first row
    let cancelled = false
    supabase
      .from('cheques')
      .select('cheque_number')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setRows((prev) => (prev.length > 0 ? prev : [makeRow([], data?.cheque_number)]))
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Once your accounts have loaded, fill in rows that don't have a bank yet.
  useEffect(() => {
    if (!defaultBank) return
    setRows((prev) => prev.map((r) => (r.bank_name ? r : { ...r, bank_name: defaultBank, bank_account_id: defaultAccountId })))
  }, [defaultBank, defaultAccountId])

  const makeRow = (existing: BulkRow[], lastDbChequeNumber?: string): BulkRow => {
    let newChequeNumber = ''
    if (existing.length > 0) {
      newChequeNumber = nextChequeNumber(existing[existing.length - 1].cheque_number)
    } else if (lastDbChequeNumber) {
      newChequeNumber = nextChequeNumber(lastDbChequeNumber)
    }
    return {
      id: crypto.randomUUID(),
      party_id: isPartyWise ? partyId! : '',
      cheque_number: newChequeNumber,
      bank_name: defaultBank,
      bank_account_id: defaultAccountId,
      amount: '',
      issue_date: todayISO(),
      due_date: todayISO(),
      notes: '',
    }
  }

  const handleAddRow = () => {
    setRows((prev) => [...prev, makeRow(prev)])
  }

  const updateRow = (id: string, field: keyof BulkRow, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        
        // Auto-format amount if that's the field
        if (field === 'amount') {
          return { ...r, amount: formatAmountInput(value) }
        }

        const newRow = { ...r, [field]: value }
        
        // If changing issue date, maybe sync due date if they were same? (optional)
        return newRow
      })
    )
  }

  const removeRow = (id: string) => {
    if (rows.length === 1) return
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  const handleSubmit = async () => {
    // Validation
    const invalid = rows.find(
      (r) => !r.party_id || !r.cheque_number || !r.bank_name || !parseAmount(r.amount) || !r.issue_date || !r.due_date
    )
    if (invalid) {
      toast.error('Please fill all required fields in all rows.')
      return
    }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      toast.error('Not authenticated')
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
      toast.error(`Nothing was saved: ${error.message}. Your rows are still here — fix and try again.`)
      return
    }
    toast.success(`Successfully added ${rows.length} cheque${rows.length === 1 ? '' : 's'}.`)
    navigate('/cheques')
  }

  const selectedParty = parties.find((p) => p.id === partyId)
  const existingNumbers = useExistingChequeNumbers(rows.map((r) => r.cheque_number))
  const rowNumberCounts = rows.reduce((m, r) => {
    const n = r.cheque_number.trim()
    if (n) m.set(n, (m.get(n) ?? 0) + 1)
    return m
  }, new Map<string, number>())

  return (
    <div className="space-y-4 pb-12">
      <PageHeader
        back={() => navigate(-1)}
        title={isPartyWise ? 'Add cheques for a party' : 'Add several cheques'}
        subtitle={
          isPartyWise && selectedParty ? (
            <>
              Given cheques for <strong className="font-semibold text-ink">{selectedParty.name}</strong>
            </>
          ) : (
            'Given cheques, many at once'
          )
        }
        actions={
          <>
            <Button variant="outline" onClick={() => handleAddRow()}>
              <Plus />
              Add row
            </Button>
            <Button onClick={handleSubmit} disabled={loading || rows.length === 0}>
              <Save />
              {loading ? 'Saving…' : 'Save all'}
            </Button>
          </>
        }
      />

      <div className="space-y-4 mt-6">
        {rows.map((row) => (
          <Card key={row.id} className="relative group">
            <CardContent className="p-4">
              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-start">
                {!isPartyWise && (
                  <div className="space-y-1.5 lg:col-span-1">
                    <Label className="text-xs">Party *</Label>
                    <Combobox
                      options={partyOptions}
                      value={row.party_id}
                      onChange={(v) => updateRow(row.id, 'party_id', v)}
                      placeholder="Select party"
                      title="Party"
                      emptyText="No party found"
                    />
                  </div>
                )}
                
                <div className="space-y-1.5 lg:col-span-1">
                  <Label className="text-xs">Cheque No. *</Label>
                  <Input
                    value={row.cheque_number}
                    onChange={(e) => updateRow(row.id, 'cheque_number', e.target.value)}
                  />
                  {(() => {
                    const n = row.cheque_number.trim()
                    const warning = (rowNumberCounts.get(n) ?? 0) > 1
                      ? 'Repeated in another row'
                      : describeExisting(existingNumbers.get(n))
                    return warning ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400">{warning}</p>
                    ) : null
                  })()}
                </div>

                <div className="space-y-1.5 lg:col-span-1">
                  <Label className="text-xs" htmlFor={`bank-${row.id}`}>
                    From your account *
                  </Label>
                  <AccountPicker
                    id={`bank-${row.id}`}
                    bare
                    value={{ accountId: row.bank_account_id, bankName: row.bank_name }}
                    onChange={(v) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, bank_account_id: v.accountId, bank_name: v.bankName } : r)))}
                  />
                </div>

                <div className="space-y-1.5 lg:col-span-1">
                  <Label className="text-xs">Amount *</Label>
                  <Input
                    value={row.amount}
                    onChange={(e) => updateRow(row.id, 'amount', e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-1.5 lg:col-span-1">
                  <Label className="text-xs">Issue Date *</Label>
                  <DateInput
                    value={row.issue_date}
                    onChange={(v) => updateRow(row.id, 'issue_date', v)}
                  />
                </div>

                <div className="space-y-1.5 lg:col-span-1">
                  <Label className="text-xs">Due Date *</Label>
                  <DateInput
                    value={row.due_date}
                    onChange={(v) => updateRow(row.id, 'due_date', v)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
