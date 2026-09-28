import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Trash2, X } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import type { Party } from '@/types'

const partySchema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  contact_name: z.string().optional(),
  phone: z.string().optional(),
  bank_name: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean(),
})

type PartyFormData = z.infer<typeof partySchema>

function valuesOf(party?: Party | null): PartyFormData {
  return {
    name: party?.name ?? '',
    contact_name: party?.contact_name ?? '',
    phone: party?.phone ?? '',
    bank_name: party?.bank_name ?? '',
    notes: party?.notes ?? '',
    is_active: party?.is_active ?? true,
  }
}

interface PartyFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  party?: Party | null
  /** Return false when saving failed (caller shows the error) to keep the form open. */
  onSubmit: (data: PartyFormData) => Promise<boolean | void>
  /** Throw when deleting failed (caller shows the error) to keep the form open. */
  onDelete?: () => Promise<void>
}

function Optional() {
  return <span className="font-normal text-ink-quiet"> (optional)</span>
}

/** Add or edit a party: a sheet like the cheque forms. */
export function PartyForm({ open, onOpenChange, party, onSubmit, onDelete }: PartyFormProps) {
  const [deleting, setDeleting] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, watch, setValue } = useForm<PartyFormData>({
    resolver: zodResolver(partySchema),
    defaultValues: valuesOf(party),
  })

  // Each time it opens, start from the party as saved (or blank), not from an earlier visit.
  const wasOpen = useRef(open)
  useEffect(() => {
    if (open && !wasOpen.current) reset(valuesOf(party))
    wasOpen.current = open
  }, [open, party, reset])

  const isActive = watch('is_active')

  const handleFormSubmit = async (data: PartyFormData) => {
    const saved = await onSubmit(data)
    if (saved === false) return
    onOpenChange(false)
  }

  const handleDelete = async () => {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete()
      onOpenChange(false)
    } catch {
      // The caller shows the error.
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto bg-background p-0 sm:max-w-[480px] [&>button:last-child]:hidden">
        <div className="sticky top-0 z-10 flex h-[60px] shrink-0 items-center gap-1 border-b bg-background/95 px-2 backdrop-blur">
          <Button variant="ghost" size="icon" aria-label="Close" onClick={() => onOpenChange(false)}>
            <X />
          </Button>
          <SheetTitle className="text-lg font-semibold">{party ? 'Edit party' : 'New party'}</SheetTitle>
          <SheetDescription className="sr-only">
            A person or business you give cheques to or receive cheques from.
          </SheetDescription>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-1 flex-col gap-[18px] px-4 pt-[18px]">
          <div className="flex flex-col">
            <Label htmlFor="party-name">Name</Label>
            <Input id="party-name" autoComplete="off" {...register('name')} />
            {errors.name && <p className="mt-1 text-sm text-problem">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col">
            <Label htmlFor="party-contact">
              Contact person
              <Optional />
            </Label>
            <Input id="party-contact" autoComplete="off" {...register('contact_name')} />
          </div>
          <div className="grid gap-[18px] sm:grid-cols-2 sm:gap-3">
            <div className="flex flex-col">
              <Label htmlFor="party-phone">
                Phone
                <Optional />
              </Label>
              <Input id="party-phone" type="tel" inputMode="tel" autoComplete="off" {...register('phone')} />
            </div>
            <div className="flex flex-col">
              <Label htmlFor="party-bank">
                Their bank
                <Optional />
              </Label>
              <Input id="party-bank" autoComplete="off" {...register('bank_name')} />
            </div>
          </div>
          <div className="flex flex-col">
            <Label htmlFor="party-notes">
              Note
              <Optional />
            </Label>
            <Textarea id="party-notes" rows={3} {...register('notes')} />
          </div>
          {party && (
            <label htmlFor="party-active" className="flex items-center justify-between gap-4 rounded-xl border bg-surface p-4">
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold">Active</span>
                <span className="text-sm text-ink-quiet">Inactive parties are left out of the party picker. Their cheques stay.</span>
              </span>
              <Switch id="party-active" checked={isActive} onCheckedChange={(v) => setValue('is_active', v, { shouldDirty: true })} />
            </label>
          )}

          {party && onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" className="self-start text-problem hover:bg-problem-soft hover:text-problem" disabled={deleting}>
                  <Trash2 />
                  Delete party
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {party.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    They disappear from your parties and the party picker. Their cheques and history stay. You can't undo this
                    in the app.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault()
                      void handleDelete()
                    }}
                    disabled={deleting}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    {deleting ? 'Deleting…' : 'Delete party'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <div className="sticky bottom-0 -mx-4 mt-auto border-t bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || deleting}>
              {isSubmitting ? 'Saving…' : party ? 'Save' : 'Add party'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
