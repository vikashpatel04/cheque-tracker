import { createContext, useContext } from 'react'
import type { Region } from '@/lib/region'
import type { Settings, SettingsUpdate } from '@/types'

export interface SettingsContextValue {
  settings: Settings
  /** Null until the user has picked a country. */
  region: Region | null
  /** Save changes and share the updated settings with the whole app. */
  updateSettings: (updates: SettingsUpdate) => Promise<{ error?: string }>
  fetchSettings: () => Promise<void>
}

export const SettingsContext = createContext<SettingsContextValue | null>(null)

/**
 * The signed-in user's settings. SettingsProvider loads them once for the
 * whole app, so every page shares the same copy.
 */
export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>')
  return {
    ...ctx,
    allocationSort: ctx.settings.allocation_sort ?? 'due_date_asc',
  }
}
