import { useMemo, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useParties } from '@/hooks/useParties'

interface PartyPickerProps {
  id: string
  label: string
  value: string
  onChange: (partyId: string) => void
  error?: string
}

/** Pick a party, or add a new one without leaving the form. */
export function PartyPicker({ id, label, value, onChange, error }: PartyPickerProps) {
  const { parties, createParty } = useParties()
  const [adding, setAdding] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const options = useMemo<ComboboxOption[]>(
    () => parties.map((p) => ({ value: p.id, label: p.name, hint: p.bank_name ?? undefined })),
    [parties]
  )

  const add = async () => {
    const name = adding?.trim()
    if (!name) return
    setSaving(true)
    const { data, error: saveError } = await createParty({
      name,
      contact_name: null,
      phone: null,
      bank_name: null,
      notes: null,
      is_active: true,
    })
    setSaving(false)
    if (saveError || !data) {
      toast.error(`Couldn't add the party: ${saveError ?? 'unknown error'}`)
      return
    }
    onChange(data.id)
    setAdding(null)
  }

  return (
    <div className="flex flex-col">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Combobox
          id={id}
          className="flex-1"
          options={options}
          value={value}
          onChange={onChange}
          placeholder="Choose a party"
          searchPlaceholder="Type a name"
          emptyText="No party by that name. Add it with the button beside."
        />
        <Button type="button" variant="outline" size="icon" className="h-12 w-12" aria-label="Add a new party" onClick={() => setAdding('')}>
          <UserPlus />
        </Button>
      </div>
      {error && <p className="mt-1 text-sm text-problem">{error}</p>}

      <Dialog open={adding !== null} onOpenChange={(open) => !open && setAdding(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New party</DialogTitle>
            <DialogDescription>Add their phone, bank and notes later from Parties.</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void add()
            }}
          >
            <div className="flex flex-col">
              <Label htmlFor={`${id}-new`}>Name</Label>
              <Input id={`${id}-new`} value={adding ?? ''} onChange={(e) => setAdding(e.target.value)} autoFocus />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setAdding(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!adding?.trim() || saving}>
                {saving ? 'Adding…' : 'Add party'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
