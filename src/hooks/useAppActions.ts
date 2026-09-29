import { createContext, useContext } from 'react'
import type { ReceivedActionMode } from '@/components/received/ReceivedActionDialog'
import type { ChequeDirection } from '@/components/shared/DirectionSwitch'
import type { GuideTopicId } from '@/lib/guide'
import type { Cheque } from '@/types'
import type { ReceivedCheque } from '@/types/received'

/**
 * Things you can do from anywhere: the New menu, search and the cheque
 * detail. AppActionsProvider (components/shared/AppActions.tsx) holds the
 * dialogs once, so any page can open them without leaving the page.
 */
export interface AppActions {
  /** The New cheque form, in the given direction or the one used last. */
  newCheque: (direction?: ChequeDirection, partyId?: string) => void
  /** A new given or received cheque, optionally to or from this party. */
  newGivenCheque: (partyId?: string) => void
  newReceivedCheque: (partyId?: string) => void
  /** A series of received cheques: rent, instalments. Optionally from this party. */
  newSeries: (partyId?: string) => void
  editReceivedCheque: (cheque: ReceivedCheque) => void
  editCheque: (cheque: Cheque) => void
  /** A new cheque in place of a written-off one, filled in from it and linked to it. */
  replaceCheque: (cheque: Cheque) => void
  /** Add funds, optionally starting from the amount that's needed. */
  addFunds: (amount?: number) => void
  importCheques: () => void
  openSearch: () => void
  /** One answer from the guide, beside the page (plan item 75). */
  openHelp: (topic: GuideTopicId) => void
  /** A given cheque's detail. */
  openCheque: (id: string) => void
  /** Deposit received cheques: these ones ticked, or the ones due today when the list is empty. */
  depositReceived: (ids: string[]) => void
  openReceivedCheque: (id: string) => void
  /** One action on a received cheque, such as marking it cleared. */
  actOnReceived: (mode: ReceivedActionMode, cheque: ReceivedCheque) => void
}

export const AppActionsContext = createContext<AppActions | null>(null)

export function useAppActions(): AppActions {
  const actions = useContext(AppActionsContext)
  if (!actions) throw new Error('useAppActions must be used inside AppActionsProvider')
  return actions
}
