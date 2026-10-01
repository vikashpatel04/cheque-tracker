import { useEffect, useRef, useState } from 'react'

/**
 * The check that a person, not a script, is signing up or in (plan item 52):
 * Cloudflare Turnstile, which usually passes without asking anything. It's on
 * only when VITE_TURNSTILE_SITE_KEY is set, and Supabase's CAPTCHA setting
 * must then be on with the matching secret (docs/editions.md). Forms use it
 * through useCaptcha (hooks/useCaptcha.tsx).
 */

export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface Turnstile {
  render(container: HTMLElement, options: Record<string, unknown>): string
  remove(widgetId: string): void
}

declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

let loading: Promise<void> | null = null

/** Turnstile's script, loaded the first time a form needs it. */
function loadTurnstile(): Promise<void> {
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loading = null
      script.remove()
      reject(new Error("Turnstile didn't load"))
    }
    document.head.appendChild(script)
  })
  return loading
}

/** One check. It hands its token over once it passes; a token works once. */
export function TurnstileWidget({ onToken }: { onToken: (token: string | null) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'checking' | 'passed' | 'failed'>('checking')

  useEffect(() => {
    let cancelled = false
    let widget: string | null = null
    loadTurnstile()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return
        widget = window.turnstile.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
          size: 'flexible',
          // Shown only when Cloudflare needs the person to do something.
          appearance: 'interaction-only',
          callback: (token: string) => {
            setState('passed')
            onToken(token)
          },
          'expired-callback': () => {
            setState('checking')
            onToken(null)
          },
          'error-callback': () => {
            setState('failed')
            onToken(null)
          },
        })
      })
      .catch(() => !cancelled && setState('failed'))
    return () => {
      cancelled = true
      if (widget) window.turnstile?.remove(widget)
    }
  }, [onToken])

  return (
    <div className="flex flex-col gap-1">
      <div ref={box} />
      {state === 'checking' && <p className="text-[13px] text-ink-quiet">Checking that you&apos;re a person…</p>}
      {state === 'failed' && (
        <p className="text-sm text-problem">The check that you&apos;re a person didn&apos;t work. Check your connection, then reload the page.</p>
      )}
    </div>
  )
}
