import { useState } from 'react'
import { Landmark, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SettingsSection } from '@/components/settings/SettingsSection'
import { BankAccountDialog } from '@/components/shared/BankAccountDialog'
import { Chip } from '@/components/shared/Chip'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import type { BankAccount } from '@/types/received'

/** Settings → Your bank accounts: the ones you write cheques from and deposit cheques into. */
export function BankAccountsCard() {
  const { accounts, loading } = useBankAccounts()
  // null: closed; 'new': adding; an account: editing it.
  const [editing, setEditing] = useState<BankAccount | 'new' | null>(null)

  return (
    <SettingsSection
      id="accounts"
      title="Your bank accounts"
      description="The accounts you write cheques from and deposit cheques into. Only a name and the last four digits are kept, never the full number."
      action={
        <Button variant="outline" onClick={() => setEditing('new')}>
          <Plus />
          Add account
        </Button>
      }
    >
      {loading ? (
        <p className="text-sm text-ink-quiet">Loading…</p>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-ink-quiet">No accounts yet. Add the one you write cheques from or deposit them into.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {accounts.map((account) => (
            <li key={account.id} className="flex min-h-[52px] items-center gap-3 rounded-xl border px-3.5 py-2">
              <Landmark className="h-5 w-5 shrink-0 text-ink-quiet" aria-hidden="true" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="text-[15px] font-semibold">{account.name}</span>
                  {account.last4 && <span className="font-cheque text-sm tracking-[0.06em] text-ink-quiet">···{account.last4}</span>}
                  {account.is_default && (
                    <Chip tone="progress" size="sm">
                      Default
                    </Chip>
                  )}
                </span>
                <span className="truncate text-[13px] text-ink-quiet">{account.bank_name}</span>
              </span>
              <Button variant="ghost" className="text-brand" aria-label={`Edit ${account.name}`} onClick={() => setEditing(account)}>
                Edit
              </Button>
            </li>
          ))}
        </ul>
      )}

      <BankAccountDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        account={editing === 'new' ? null : editing}
        makeDefault={accounts.length === 0}
      />
    </SettingsSection>
  )
}
