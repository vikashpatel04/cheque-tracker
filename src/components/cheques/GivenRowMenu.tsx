import { Ban, CheckCheck, EllipsisVertical, PanelRight, Pencil, Repeat, Undo2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { canChainDepositedAndPassed, STATUS_ACTION_META } from '@/components/cheques/StatusActions'
import type { GivenActions } from '@/components/cheques/useGivenActions'
import { isLegacyRepresented } from '@/lib/chequeTags'
import { cn } from '@/lib/utils'
import { VALID_STATUS_TRANSITIONS, type Cheque } from '@/types'

/** The ⋯ menu on a given cheque's row: every status change, and edit or undo. */
export function GivenRowMenu({ cheque, actions, className }: { cheque: Cheque; actions: GivenActions; className?: string }) {
  const transitions = VALID_STATUS_TRANSITIONS[cheque.status]
  const legacy = isLegacyRepresented(cheque)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for cheque ${cheque.cheque_number}`}
          onClick={(e) => e.stopPropagation()}
          className={cn('flex h-9 w-9 items-center justify-center rounded-lg text-ink-quiet transition-colors hover:bg-hover hover:text-ink', className)}
        >
          <EllipsisVertical className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64" onClick={(e) => e.stopPropagation()}>
        {transitions.map((status) => {
          const { label, Icon } = STATUS_ACTION_META[status]
          return (
            <DropdownMenuItem
              key={status}
              onSelect={() => actions.setStatus(cheque, status)}
              className={status === 'RETURNED' ? 'text-problem focus:text-problem' : undefined}
            >
              <Icon className={status === 'RETURNED' ? 'h-4 w-4' : 'h-4 w-4 text-ink-quiet'} />
              Mark {label.toLowerCase()}
              {status === 'RETURNED' && '…'}
            </DropdownMenuItem>
          )
        })}
        {canChainDepositedAndPassed(cheque.status) && (
          <DropdownMenuItem onSelect={() => actions.fundAndPass(cheque)}>
            <CheckCheck className="text-ink-quiet" />
            Mark funded and passed
          </DropdownMenuItem>
        )}
        {cheque.status === 'RETURNED' && !legacy && (
          <>
            <DropdownMenuItem onSelect={() => actions.represent(cheque)}>
              <Repeat className="text-ink-quiet" />
              Present it again…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.writeOff(cheque)} className="text-problem focus:text-problem">
              <Ban />
              Write it off…
            </DropdownMenuItem>
          </>
        )}
        {(transitions.length > 0 || cheque.status === 'RETURNED') && <DropdownMenuSeparator />}
        <DropdownMenuItem onSelect={() => actions.open(cheque)}>
          <PanelRight className="text-ink-quiet" />
          Open
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.edit(cheque)}>
          <Pencil className="text-ink-quiet" />
          Edit
        </DropdownMenuItem>
        {!legacy && (
          <DropdownMenuItem onSelect={() => actions.undo(cheque)}>
            <Undo2 className="text-ink-quiet" />
            Undo last change
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
