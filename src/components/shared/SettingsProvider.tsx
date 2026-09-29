import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { SettingsContext, type SettingsContextValue } from '@/hooks/useSettings'
import { runAutoTransition } from '@/lib/autoTransition'
import { regionFromSettings, regionKey, setActiveRegion } from '@/lib/region'
import { supabase } from '@/lib/supabase'
import Onboarding from '@/pages/Onboarding'
import type { Settings, SettingsUpdate } from '@/types'

function FullPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
      {children}
    </div>
  )
}

/**
 * Loads the signed-in user's settings once and shares them with the app.
 *
 * Until the user has picked a country it shows the region setup instead. The
 * region drives every amount and date, so the app is remounted when it
 * changes and everything re-renders in the new format.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    setError(null)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError('Not signed in')
      setLoading(false)
      return
    }

    const { data, error: selectError } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    if (selectError) {
      setError(selectError.message)
      setLoading(false)
      return
    }

    let row = data
    if (!row) {
      // The sign-up trigger normally creates this row.
      const { data: created, error: insertError } = await supabase
        .from('settings')
        .insert({ user_id: user.id })
        .select()
        .single()
      if (insertError) {
        setError(insertError.message)
        setLoading(false)
        return
      }
      row = created
    }

    setSettings(row as Settings)
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchSettings()
  }, [fetchSettings])

  const updateSettings = useCallback(
    async (updates: SettingsUpdate) => {
      if (!settings) return { error: 'Settings are not loaded yet' }
      const { data, error: updateError } = await supabase
        .from('settings')
        .update(updates)
        .eq('id', settings.id)
        .select()
        .single()
      if (updateError) return { error: updateError.message }
      setSettings(data as Settings)
      return {}
    },
    [settings]
  )

  const region = useMemo(() => (settings ? regionFromSettings(settings) : null), [settings])

  // The formatters read the active region, so set it before children render.
  if (region) setActiveRegion(region)

  // Client-side auto-pass, once per visit, after the time zone is known.
  const autoPassRan = useRef(false)
  useEffect(() => {
    if (!settings || !region || autoPassRan.current) return
    autoPassRan.current = true
    runAutoTransition(settings).catch(console.error)
  }, [settings, region])

  const value = useMemo<SettingsContextValue | null>(
    () => (settings ? { settings, region, updateSettings, fetchSettings } : null),
    [settings, region, updateSettings, fetchSettings]
  )

  if (loading) {
    return (
      <FullPage>
        <p className="text-muted-foreground">Loading...</p>
      </FullPage>
    )
  }

  if (!value) {
    return (
      <FullPage>
        <p className="text-sm text-destructive">Couldn't load your settings: {error ?? 'unknown error'}</p>
        <Button
          variant="outline"
          onClick={() => {
            setLoading(true)
            void fetchSettings()
          }}
        >
          Try again
        </Button>
      </FullPage>
    )
  }

  return (
    <SettingsContext.Provider value={value}>
      {region ? <Fragment key={regionKey(region)}>{children}</Fragment> : <Onboarding />}
    </SettingsContext.Provider>
  )
}
