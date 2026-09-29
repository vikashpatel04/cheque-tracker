import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { BankAccountDialog } from '@/components/shared/BankAccountDialog'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { bankChoices } from '@/lib/bankAccounts'

interface BankPickerProps {
  id: string
  label?: string
  value: string
  onChange: (bank: string) => void
  error?: string
  /** Leave out the label and error, e.g. in a table row. */
  bare?: boolean
}

/** The bank a cheque you give is drawn on: one of your accounts' banks, or add an account here. */
export function BankPicker({ id, label = 'Your bank', value, onChange, error, bare }: BankPickerProps) {
  const { accounts } = useBankAccounts()
  const [adding, setAdding] = useState(false)
  const options = useMemo(() => bankChoices(accounts, value), [accounts, value])

  const picker = (
    <div className="flex gap-2">
      <Combobox
        id={id}
        className="min-w-0 flex-1"
        options={options}
        value={value}
        onChange={onChange}
        placeholder={accounts.length ? 'Choose' : 'Add your account'}
        searchPlaceholder="Find a bank"
        emptyText="None of your accounts is at that bank. Add it with the button beside."
      />
      <Button type="button" variant="outline" size="icon" className="h-12 w-12 shrink-0" aria-label="Add a bank account" onClick={() => setAdding(true)}>
        <Plus />
      </Button>
      <BankAccountDialog
        open={adding}
        onOpenChange={setAdding}
        makeDefault={accounts.length === 0}
        onSaved={(saved) => onChange(saved.bank_name)}
      />
    </div>
  )

  if (bare) return picker
  return (
    <div className="flex flex-col">
      <Label htmlFor={id}>{label}</Label>
      {picker}
      {error && <p className="mt-1 text-sm text-problem">{error}</p>}
    </div>
  )
}
