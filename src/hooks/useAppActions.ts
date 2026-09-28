import { createContext, useContext } from 'react'

/**
 * Things you can do from anywhere: the New menu, search and the cheque
 * detail. AppActionsProvider (components/shared/AppActions.tsx) holds the
 * dialogs once, so any page can open them without leaving the page.
 */
export interface AppActions {
  newGivenCheque: () => void
  addFunds: () => void
  importCheques: () => void
  openSearch: () => void
  openCheque: (id: string) => void
}

export const AppActionsContext = createContext<AppActions | null>(null)

export function useAppActions(): AppActions {
  const actions = useContext(AppActionsContext)
  if (!actions) throw new Error('useAppActions must be used inside AppActionsProvider')
  return actions
}
