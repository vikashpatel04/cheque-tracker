import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { stripTagLines, tagLines } from '@/lib/chequeTags'
import { announceDataChange } from '@/lib/dataEvents'
import { supabase } from '@/lib/supabase'

export interface NotesTarget {
  table: 'cheques' | 'received_cheques'
  id: string
  notes: string | null
  /** Who the cheque is with, and its number, for the title. */
  label: string
}

function NotesForm({ target, onClose }: { target: NotesTarget; onClose: () => void }) {
  // Given cheques can carry tag lines from the old re-present flow; they stay as they are.
  const [text, setText] = useState(target.table === 'cheques' ? stripTagLines(target.notes) : (target.notes ?? ''))
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const kept = target.table === 'cheques' ? tagLines(target.notes) : []
    const notes = [...kept, text.trim()].filter(Boolean).join('\n') || null
    setSaving(true)
    const { error } = await supabase.from(target.table).update({ notes }).eq('id', target.id)
    setSaving(false)
    if (error) {
      toast.error(`Couldn't save the notes: ${error.message}`)
      return
    }
    toast.success('Notes saved')
    announceDataChange()
    onClose()
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <div className="flex flex-col">
        <Label htmlFor="cheque-notes">Notes</Label>
        <Textarea id="cheque-notes" rows={4} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      </div>
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save notes'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/**
 * Edits a cheque's notes and nothing else: what the Free plan allows after a
 * trial or plan ends (plan item 55). The full form needs Business.
 */
export function NotesDialog({ target, onClose }: { target: NotesTarget | null; onClose: () => void }) {
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit notes</DialogTitle>
          <DialogDescription>
            {target?.label}. On the Free plan you can edit notes; changing anything else needs Business.
          </DialogDescription>
        </DialogHeader>
        {target && <NotesForm key={target.id} target={target} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}
