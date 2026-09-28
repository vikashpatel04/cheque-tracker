import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
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
  name: z.string().min(1, 'Party name is required'),
  contact_name: z.string().optional(),
  phone: z.string().optional(),
  bank_name: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean(),
})

type PartyFormData = z.infer<typeof partySchema>

interface PartyFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  party?: Party | null
  /** Return false when saving failed (caller shows the error) to keep the form open. */
  onSubmit: (data: PartyFormData) => Promise<boolean | void>
  onDelete?: () => Promise<void>
}

export function PartyForm({ open, onOpenChange, party, onSubmit, onDelete }: PartyFormProps) {
  const [deleting, setDeleting] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, watch, setValue } = useForm<PartyFormData>({
    resolver: zodResolver(partySchema),
    defaultValues: party
      ? {
          name: party.name,
          contact_name: party.contact_name ?? '',
          phone: party.phone ?? '',
          bank_name: party.bank_name ?? '',
          notes: party.notes ?? '',
          is_active: party.is_active,
        }
      : { is_active: true },
  })

  const isActive = watch('is_active')

  const handleFormSubmit = async (data: PartyFormData) => {
    const saved = await onSubmit(data)
    if (saved === false) return
    reset()
    onOpenChange(false)
  }

  const handleDelete = async () => {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete()
      reset()
      onOpenChange(false)
    } catch {
      // Caller shows error toast
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{party ? 'Edit Party' : 'Add Party'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="name">Party Name *</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div>
            <Label htmlFor="contact_name">Contact Person</Label>
            <Input id="contact_name" {...register('contact_name')} />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" {...register('phone')} />
          </div>
          <div>
            <Label htmlFor="bank_name">Bank Name</Label>
            <Input id="bank_name" {...register('bank_name')} />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...register('notes')} rows={3} />
          </div>
          {party && (
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={(v) => setValue('is_active', v)} />
              <Label className="mb-0">Active</Label>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={isSubmitting || deleting}>
            {isSubmitting ? 'Saving...' : party ? 'Update Party' : 'Add Party'}
          </Button>

          {party && onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" className="w-full" disabled={deleting}>
                  Delete Party
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {party.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will soft-delete <strong>{party.name}</strong> and hide them from dropdowns.
                    All cheque history is preserved. This action cannot be undone from the app.
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
                    {deleting ? 'Deleting...' : 'Delete Party'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </form>
      </SheetContent>
    </Sheet>
  )
}
