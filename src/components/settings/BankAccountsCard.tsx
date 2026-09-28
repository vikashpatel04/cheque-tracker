import { useState } from 'react'
import { Landmark, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Chip } from '@/components/shared/Chip'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { accountLabel, createBankAccount, removeBankAccount, updateBankAccount } from '@/lib/bankAccounts'
import type { BankAccount } from '@/types/received'

interface Draft {
  id: string | null
  name: string
  bank_name: string
  last4: string
  is_default: boolean
}

const EMPTY: Draft = { id: null, name: '', bank_name: '', last4: '', is_default: false }

/** Settings → Bank accounts: where received cheques go when you deposit them. */
export function BankAccountsCard() {
  const { accounts, loading } = useBankAccounts()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  const valid =
    !!draft && draft.name.trim() !== '' && draft.bank_name.trim() !== '' && (draft.last4 === '' || /^[0-9A-Za-z]{4}$/.test(draft.last4))

  const save = async () => {
    if (!draft || !valid) return
    setSaving(true)
    const input = {
      name: draft.name.trim(),
      bank_name: draft.bank_name.trim(),
      last4: draft.last4.trim() || null,
      is_default: draft.is_default,
    }
    const { error } = draft.id ? await updateBankAccount(draft.id, input) : await createBankAccount(input)
    setSaving(false)
    if (error) {
      toast.error(`Couldn't save the account: ${error}`)
      return
    }
    toast.success(draft.id ? 'Account saved' : 'Account added')
    setDraft(null)
  }

  const remove = async (account: BankAccount) => {
    const { error } = await removeBankAccount(account)
    if (error) toast.error(`Couldn't remove it: ${error}`)
    else toast.success(`${account.name} removed. Cheques already deposited into it keep it.`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bank accounts</CardTitle>
        <CardDescription>
          Where you deposit the cheques you receive. Only a name and the last four digits are kept, never the full number.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loading ? (
          <p className="text-sm text-ink-quiet">Loading…</p>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-ink-quiet">No accounts yet. Add the one you deposit cheques into.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-soft rounded-xl border">
            {accounts.map((account) => (
              <li key={account.id} className="flex items-center gap-3 px-3.5 py-3">
                <Landmark className="h-5 w-5 shrink-0 text-ink-quiet" aria-hidden="true" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex flex-wrap items-center gap-2 font-semibold">
                    {accountLabel(account)}
                    {account.is_default && (
                      <Chip tone="progress" size="sm">
                        Default
                      </Chip>
                    )}
                  </span>
                  <span className="text-sm text-ink-quiet">{account.bank_name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${account.name}`}
                  onClick={() =>
                    setDraft({
                      id: account.id,
                      name: account.name,
                      bank_name: account.bank_name,
                      last4: account.last4 ?? '',
                      is_default: account.is_default,
                    })
                  }
                >
                  <Pencil />
                </Button>
                <Button variant="ghost" size="icon" aria-label={`Remove ${account.name}`} onClick={() => void remove(account)}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button variant="outline" className="self-start" onClick={() => setDraft({ ...EMPTY, is_default: accounts.length === 0 })}>
          <Plus />
          Add an account
        </Button>
      </CardContent>

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Edit account' : 'Add an account'}</DialogTitle>
            <DialogDescription>How it shows when you deposit a cheque.</DialogDescription>
          </DialogHeader>
          {draft && (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                void save()
              }}
            >
              <div className="flex flex-col">
                <Label htmlFor="account-name">Name</Label>
                <Input
                  id="account-name"
                  placeholder="Current account"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="flex flex-col">
                <Label htmlFor="account-bank">Bank</Label>
                <Input id="account-bank" value={draft.bank_name} onChange={(e) => setDraft({ ...draft, bank_name: e.target.value })} />
              </div>
              <div className="flex flex-col">
                <Label htmlFor="account-last4">Last four digits (optional)</Label>
                <Input
                  id="account-last4"
                  inputMode="numeric"
                  maxLength={4}
                  className="font-cheque w-32"
                  value={draft.last4}
                  onChange={(e) => setDraft({ ...draft, last4: e.target.value.replace(/[^0-9A-Za-z]/g, '').slice(0, 4) })}
                />
              </div>
              <label className="flex items-center gap-3 text-[15px]">
                <Checkbox checked={draft.is_default} onCheckedChange={(v) => setDraft({ ...draft, is_default: v === true })} />
                Deposit into this one unless I choose another
              </label>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!valid || saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
