import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/** What this Supabase project allows, so the sign-in pages show only what works. */
export interface AuthOptions {
  google: boolean
  /** New accounts can be created (self-hosted copies usually turn this off). */
  signUp: boolean
  /** New accounts confirm their email before they can sign in. */
  confirmEmail: boolean
  /** Days of free trial for a new account; 0 without billing or a trial. */
  trialDays: number
  /** Visitors can try the demo: anonymous sign-ins are on, and this instance lets demos start (plan item 86). */
  demo: boolean
}

/** If the settings can't be read: no Google button or demo, and the server refuses what isn't allowed. */
const FALLBACK: AuthOptions = { google: false, signUp: true, confirmEmail: true, trialDays: 0, demo: false }

let pending: Promise<AuthOptions> | null = null

/**
 * The free trial a new account gets, and whether demos may start, from the
 * instance's public config. All columns, so a database without the demo
 * (migration 023) still answers.
 */
async function loadInstance(): Promise<{ trialDays: number; demos: boolean }> {
  const { data } = await supabase.from('instance_config').select('*').maybeSingle()
  return { trialDays: data?.billing_enabled ? data.trial_days : 0, demos: (data?.demos_per_hour ?? 0) > 0 }
}

/** Supabase Auth's public settings and the free trial, read once per visit. */
function loadAuthOptions(): Promise<AuthOptions> {
  pending ??= Promise.all([
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '' },
    }).then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status))))),
    loadInstance().catch(() => ({ trialDays: 0, demos: false })),
  ])
    .then(([settings, instance]) => ({
      google: settings.external?.google === true,
      signUp: settings.disable_signup !== true,
      confirmEmail: settings.mailer_autoconfirm !== true,
      trialDays: instance.trialDays,
      demo: settings.disable_signup !== true && settings.external?.anonymous_users === true && instance.demos,
    }))
    .catch(() => {
      pending = null
      return FALLBACK
    })
  return pending
}

/** null until the settings have loaded. */
export function useAuthOptions(): AuthOptions | null {
  const [options, setOptions] = useState<AuthOptions | null>(null)
  useEffect(() => {
    let cancelled = false
    void loadAuthOptions().then((loaded) => !cancelled && setOptions(loaded))
    return () => {
      cancelled = true
    }
  }, [])
  return options
}
