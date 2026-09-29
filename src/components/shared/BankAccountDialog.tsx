import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { findPreset } from '@/config/regions'
import { createBankAccount, removeBankAccount, updateBankAccount } from '@/lib/bankAccounts'
import { getActiveRegion } from '@/lib/region'
import type { BankAccount } from '@/types/received'

interface Draft {
  name: string
  bank_name: string
  last4: string
  is_default: boolean
}

interface BankAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The account to edit; leave it out to add one. */
  account?: BankAccount | null
  /** Tick "use by default" on a new account, e.g. the first one. */
  makeDefault?: boolean
  /** After saving, with the account's id and bank, e.g. to pick it in a form. */
  onSaved?: (saved: { id: string; bank_name: string }) => void
}

/**
 * Add or edit one of your bank accounts, from Settings or straight from a
 * cheque form. The bank field suggests the usual banks for your country
 * (region presets).
 */
export function BankAccountDialog({ open, onOpenChange, account, makeDefault, onSaved }: BankAccountDialogProps) {
  const [draft, setDraft] = useState<Draft>({ name: '', bank_name: '', last4: '', is_default: false })
  const [saving, setSaving] = useState(false)
  const suggestions = findPreset(getActiveRegion().country)?.banks ?? []

  useEffect(() => {
    if (!open) return
    setDraft(
      account
        ? { name: account.name, bank_name: account.bank_name, last4: account.last4 ?? '', is_default: account.is_default }
        : { name: '', bank_name: '', last4: '', is_default: !!makeDefault }
    )
  }, [open, account, makeDefault])

  const valid = draft.name.trim() !== '' && draft.bank_name.trim() !== '' && (draft.last4 === '' || /^[0-9A-Za-z]{4}$/.test(draft.last4))

  const save = async () => {
    if (!valid) return
    setSaving(true)
    const input = {
      name: draft.name.trim(),
      bank_name: draft.bank_name.trim(),
      last4: draft.last4.trim() || null,
      is_default: draft.is_default,
    }
    const result = account ? await updateBankAccount(account.id, input) : await createBankAccount(input)
    setSaving(false)
    if (result.error) {
      toast.error(`Couldn't save the account: ${result.error}`)
      return
    }
    toast.success(account ? 'Account saved' : 'Account added')
    onSaved?.({ id: account?.id ?? result.id ?? '', bank_name: input.bank_name })
    onOpenChange(false)
  }

  const remove = async () => {
    if (!account) return
    setSaving(true)
    const { error } = await removeBankAccount(account)
    setSaving(false)
    if (error) {
      toast.error(`Couldn't remove it: ${error}`)
      return
    }
    toast.success(`${account.name} removed. Cheques already on it keep it.`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{account ? 'Edit account' : 'Add an account'}</DialogTitle>
          <DialogDescription>An account you write cheques from or deposit cheques into.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            // Inside another form (a cheque form), don't submit that one too.
            e.stopPropagation()
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
            <Input
              id="account-bank"
              list="account-bank-suggestions"
              autoComplete="off"
              value={draft.bank_name}
              onChange={(e) => setDraft({ ...draft, bank_name: e.target.value })}
            />
            <datalist id="account-bank-suggestions">
              {suggestions.map((bank) => (
                <option key={bank} value={bank} />
              ))}
            </datalist>
          </div>
          <div className="flex flex-col">
            <Label htmlFor="account-last4">
              Last four digits <span className="font-normal text-ink-quiet">(optional)</span>
            </Label>
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
            Use this one unless I choose another
          </label>
          <DialogFooter className="gap-2 sm:justify-between">
            {account ? (
              <Button
                type="button"
                variant="ghost"
                className="text-problem hover:bg-problem-soft hover:text-problem"
                disabled={saving}
                onClick={() => void remove()}
              >
                <Trash2 />
                Remove account
              </Button>
            ) : (
              <span />
            )}
            <span className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!valid || saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </span>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
