import { Check, CheckCheck, CircleHelp, Landmark, Wallet, type LucideIcon } from 'lucide-react'
import type { GivenActions } from '@/components/cheques/useGivenActions'
import type { AppActions } from '@/hooks/useAppActions'
import type { ListRow } from '@/lib/chequeList'
import { isLegacyRepresented } from '@/lib/chequeTags'

export interface NextAction {
  /** Full label for buttons: "Mark funded". */
  label: string
  /** One word for the swipe: "Funded". */
  short: string
  icon: LucideIcon
  run: () => void
}

/**
 * A cheque's next step, as one button (plan item 71): Pending → Mark funded,
 * Funded → Mark passed, Returned → decide. Received: in hand → Deposit, in
 * clearing → Mark cleared, bounced → decide. Finished cheques have none.
 */
export function nextAction(row: ListRow, given: GivenActions, app: AppActions): NextAction | null {
  const g = row.given
  if (g) {
    if (g.status === 'PENDING') return { label: 'Mark funded', short: 'Funded', icon: Wallet, run: () => given.setStatus(g, 'DEPOSITED') }
    if (g.status === 'DEPOSITED') return { label: 'Mark passed', short: 'Passed', icon: CheckCheck, run: () => given.setStatus(g, 'PASSED') }
    if (g.status === 'RETURNED' && !isLegacyRepresented(g)) return { label: 'Decide', short: 'Decide', icon: CircleHelp, run: () => given.open(g) }
    return null
  }
  const r = row.received
  if (!r) return null
  if (r.status === 'IN_HAND' && r.kind === 'REGULAR') return { label: 'Deposit', short: 'Deposit', icon: Landmark, run: () => app.depositReceived([r.id]) }
  if (r.status === 'DEPOSITED') return { label: 'Mark cleared', short: 'Cleared', icon: Check, run: () => app.actOnReceived('clear', r) }
  if (r.status === 'BOUNCED') return { label: 'Decide', short: 'Decide', icon: CircleHelp, run: () => app.openReceivedCheque(r.id) }
  return null
}
