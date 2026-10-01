import { useEffect, useState } from 'react'

/** What this Supabase project allows, so the sign-in pages show only what works. */
export interface AuthOptions {
  google: boolean
  /** New accounts can be created (self-hosted copies usually turn this off). */
  signUp: boolean
  /** New accounts confirm their email before they can sign in. */
  confirmEmail: boolean
}

/** If the settings can't be read: no Google button, and the server refuses what isn't allowed. */
const FALLBACK: AuthOptions = { google: false, signUp: true, confirmEmail: true }

let pending: Promise<AuthOptions> | null = null

/** Supabase Auth's public settings, read once per visit. */
function loadAuthOptions(): Promise<AuthOptions> {
  pending ??= fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '' },
  })
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
    .then((settings) => ({
      google: settings.external?.google === true,
      signUp: settings.disable_signup !== true,
      confirmEmail: settings.mailer_autoconfirm !== true,
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
