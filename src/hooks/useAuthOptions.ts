import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/** What this Supabase project allows, so the sign-in pages show only what works. */
export interface AuthOptions {
  google: boolean
  /** New accounts can be created (self-hosted copies usually turn this off). */
  signUp: boolean
  /**
   * Sign-ups are paused for now (`instance_config.signups_open`, migration 024),
   * so the app shows them as coming soon and points to the demo instead.
   */
  signUpPaused: boolean
  /** New accounts confirm their email before they can sign in. */
  confirmEmail: boolean
  /** Days of free trial for a new account; 0 without billing or a trial. */
  trialDays: number
  /** Visitors can try the demo: anonymous sign-ins are on, and this instance lets demos start (plan item 86). */
  demo: boolean
}

/** If the settings can't be read: no Google button or demo, and the server refuses what isn't allowed. */
const FALLBACK: AuthOptions = { google: false, signUp: true, signUpPaused: false, confirmEmail: true, trialDays: 0, demo: false }

let pending: Promise<AuthOptions> | null = null

/**
 * The free trial a new account gets, whether demos may start and whether
 * sign-ups are open, from the instance's public config. All columns, so a
 * database without the newer ones (migrations 023 and 024) still answers.
 */
async function loadInstance(): Promise<{ trialDays: number; demos: boolean; signupsOpen: boolean }> {
  const { data } = await supabase.from('instance_config').select('*').maybeSingle()
  return {
    trialDays: data?.billing_enabled ? data.trial_days : 0,
    demos: (data?.demos_per_hour ?? 0) > 0,
    signupsOpen: data?.signups_open !== false,
  }
}

/** Supabase Auth's public settings and the free trial, read once per visit. */
function loadAuthOptions(): Promise<AuthOptions> {
  pending ??= Promise.all([
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '' },
    }).then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status))))),
    loadInstance().catch(() => ({ trialDays: 0, demos: false, signupsOpen: true })),
  ])
    .then(([settings, instance]) => {
      // Supabase's own switch also stops anonymous sign-ins, so a paused
      // instance leaves it on and pauses with signups_open instead.
      const projectSignUp = settings.disable_signup !== true
      return {
        google: settings.external?.google === true,
        signUp: projectSignUp && instance.signupsOpen,
        signUpPaused: projectSignUp && !instance.signupsOpen,
        confirmEmail: settings.mailer_autoconfirm !== true,
        trialDays: instance.trialDays,
        demo: projectSignUp && settings.external?.anonymous_users === true && instance.demos,
      }
    })
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
