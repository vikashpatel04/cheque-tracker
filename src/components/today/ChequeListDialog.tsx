import { ChevronRight } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { StatusPill } from '@/components/shared/StatusPill'
import { formatMoney, formatShortDate } from '@/lib/formatters'
import type { Cheque } from '@/types'

interface ChequeListDialogProps {
  title: string | null
  description?: string
  cheques: Cheque[]
  onClose: () => void
  onSelect: (id: string) => void
}

/** The given cheques behind a to-do, to open one at a time. */
export function ChequeListDialog({ title, description, cheques, onClose, onSelect }: ChequeListDialogProps) {
  return (
    <Dialog open={!!title} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <ul className="-mx-2 flex max-h-[60vh] flex-col overflow-y-auto">
          {cheques.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-hover"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold">{c.party?.name ?? 'Unknown party'}</span>
                    <StatusPill status={c.status} />
                  </span>
                  <span className="truncate text-sm text-ink-quiet">
                    <span className="font-cheque">{c.cheque_number}</span> · {c.bank_name} · due {formatShortDate(c.due_date)}
                  </span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{'−'}{formatMoney(Number(c.amount))}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
