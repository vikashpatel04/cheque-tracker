import { createContext, useContext } from 'react'
import type { Cheque } from '@/types'

/**
 * Things you can do from anywhere: the New menu, search and the cheque
 * detail. AppActionsProvider (components/shared/AppActions.tsx) holds the
 * dialogs once, so any page can open them without leaving the page.
 */
export interface AppActions {
  newGivenCheque: () => void
  editCheque: (cheque: Cheque) => void
  /** A new cheque in place of a written-off one, filled in from it and linked to it. */
  replaceCheque: (cheque: Cheque) => void
  /** Add funds, optionally starting from the amount that's needed. */
  addFunds: (amount?: number) => void
  importCheques: () => void
  openSearch: () => void
  /** A given cheque's detail. */
  openCheque: (id: string) => void
  /** Received cheques: deposit these, or open one. Their screens come with plan item 14, step 4. */
  depositReceived: (ids: string[]) => void
  openReceivedCheque: (id: string) => void
}

export const AppActionsContext = createContext<AppActions | null>(null)

export function useAppActions(): AppActions {
  const actions = useContext(AppActionsContext)
  if (!actions) throw new Error('useAppActions must be used inside AppActionsProvider')
  return actions
}
