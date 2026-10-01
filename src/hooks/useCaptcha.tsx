import { useCallback, useState } from 'react'
import { TURNSTILE_SITE_KEY, TurnstileWidget } from '@/components/auth/TurnstileWidget'

/**
 * The bot check for a sign-in form (components/auth/TurnstileWidget.tsx): put
 * `element` in the form, send `token` with the request, and wait for `ready`.
 * A token works once, so call `reset()` after each attempt. Without a site key
 * there's nothing to show and `ready` is true.
 */
export function useCaptcha() {
  const [token, setToken] = useState<string | null>(null)
  const [round, setRound] = useState(0)

  const reset = useCallback(() => {
    setToken(null)
    setRound((n) => n + 1)
  }, [])

  return {
    token: token ?? undefined,
    ready: !TURNSTILE_SITE_KEY || !!token,
    // A new round mounts a new widget, which gets a fresh token.
    element: TURNSTILE_SITE_KEY ? <TurnstileWidget key={round} onToken={setToken} /> : null,
    reset,
  }
}
