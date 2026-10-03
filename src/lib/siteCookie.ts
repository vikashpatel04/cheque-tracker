import { supabase } from '@/lib/supabase'

/**
 * Tells the website that someone is signed in to the app (plan item 87), so
 * its home page can send them straight on to the app. Only a flag, never a
 * token or anything about the person, on the parent domain both sites share
 * (VITE_COOKIE_DOMAIN, such as ".chequetracker.com"). Without the variable,
 * as on self-hosted copies, nothing is set. A demo doesn't count as signed in.
 */
const NAME = 'ct_signed_in'
const YEAR = 365 * 24 * 60 * 60

/** The cookie that sets or clears the flag, or null when there's no valid domain. */
export function signedInCookie(signedIn: boolean, domain: string | undefined): string | null {
  const host = domain?.trim().toLowerCase()
  if (!host || !/^\.?[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return null
  const value = signedIn ? `${NAME}=1; Max-Age=${YEAR}` : `${NAME}=; Max-Age=0`
  return `${value}; Domain=${host}; Path=/; Secure; SameSite=Lax`
}

/** Keeps the flag in step with the session while the app runs, from the first look at it. */
export function watchSignedIn(domain: string | undefined = import.meta.env.VITE_COOKIE_DOMAIN) {
  if (!signedInCookie(false, domain)) return
  supabase.auth.onAuthStateChange((_event, session) => {
    const cookie = signedInCookie(!!session && !session.user.is_anonymous, domain)
    if (cookie) document.cookie = cookie
  })
}
