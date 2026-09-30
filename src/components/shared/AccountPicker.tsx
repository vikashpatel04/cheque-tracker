import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { BankAccountDialog } from '@/components/shared/BankAccountDialog'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { OTHER_BANK, accountChoices } from '@/lib/bankAccounts'

/** Which of your accounts a cheque you give is drawn on, and its bank. */
export interface AccountValue {
  accountId: string | null
  bankName: string
}

interface AccountPickerProps {
  id: string
  label?: string
  value: AccountValue
  onChange: (value: AccountValue) => void
  error?: string
  /** Leave out the label and error, e.g. in a table row. */
  bare?: boolean
}

/**
 * The account a cheque you give is drawn on (plan item 77): one of your
 * accounts, or add one here. Picking an account fills in its bank too, which
 * the cheque keeps for the companions and for older screens.
 */
export function AccountPicker({ id, label = 'From your account', value, onChange, error, bare }: AccountPickerProps) {
  const { accounts } = useBankAccounts()
  const [adding, setAdding] = useState(false)
  const options = useMemo(() => accountChoices(accounts, value), [accounts, value])

  const pick = (choice: string) => {
    const account = accounts.find((a) => a.id === choice)
    if (account) onChange({ accountId: account.id, bankName: account.bank_name })
    // An older cheque's bank or a removed account: keep it as it is.
    else if (choice !== OTHER_BANK && choice !== value.accountId) onChange({ accountId: null, bankName: '' })
  }

  const picker = (
    <div className="flex gap-2">
      <Combobox
        id={id}
        className="min-w-0 flex-1"
        options={options}
        value={value.accountId ?? (value.bankName ? OTHER_BANK : '')}
        onChange={pick}
        placeholder={accounts.length ? 'Choose' : 'Add your account'}
        searchPlaceholder="Find an account"
        emptyText="No account like that. Add it with the button beside."
      />
      <Button type="button" variant="outline" size="icon" className="h-12 w-12 shrink-0" aria-label="Add a bank account" onClick={() => setAdding(true)}>
        <Plus />
      </Button>
      <BankAccountDialog
        open={adding}
        onOpenChange={setAdding}
        makeDefault={accounts.length === 0}
        onSaved={(saved) => onChange({ accountId: saved.id || null, bankName: saved.bank_name })}
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
