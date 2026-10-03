import { forwardRef, useState, type InputHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { brand } from '@/config/brand'
import type { AuthOptions } from '@/hooks/useAuthOptions'

/** "Continue with Google", with Google's own mark. */
export function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-[52px] w-full gap-2.5 border-line-strong bg-surface text-base font-semibold text-ink"
      onClick={onClick}
      disabled={disabled}
    >
      <img src="/google-g.svg" alt="" aria-hidden="true" className="h-5 w-5" />
      Continue with Google
    </Button>
  )
}

/** "Just looking? Try the demo", where this copy of the app offers one (plan item 86). */
export function DemoLink({ options }: { options: AuthOptions | null }) {
  if (!options?.demo) return null
  return (
    <p className="mt-3 text-ink-quiet">
      Just looking?{' '}
      <Link to="/demo" className="font-semibold text-brand hover:underline">
        Try the demo
      </Link>
      , no sign-up needed.
    </p>
  )
}

/**
 * "By creating an account, you agree to the Terms and the Privacy Policy",
 * linking to the website's pages (plan items 57 and 87). Only where the app
 * has a website (VITE_SITE_URL); a self-hosted copy has its own terms, if any.
 */
export function LegalLine({ doing }: { doing: string }) {
  if (!brand.siteUrl) return null
  const link = (path: string, text: string) => (
    <a href={`${brand.siteUrl}${path}`} target="_blank" rel="noopener" className="font-medium text-ink underline underline-offset-2">
      {text}
    </a>
  )
  return (
    <p className="text-center text-[13px] leading-5 text-ink-quiet">
      By {doing}, you agree to the {link('/terms', 'Terms')} and the {link('/privacy', 'Privacy Policy')}.
    </p>
  )
}

/** The line between Google and the email form. */
export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-sm text-ink-quiet">
      <span className="h-px flex-1 bg-line" />
      or with email
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

/** A password field with Show and Hide, sized like the other sign-in fields. */
export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function PasswordInput(props, ref) {
  const [shown, setShown] = useState(false)
  return (
    <div className="flex h-[52px] items-center rounded-md border border-input bg-surface pl-3.5 pr-1.5 focus-within:ring-2 focus-within:ring-ring/40">
      <input ref={ref} type={shown ? 'text' : 'password'} className="min-w-0 flex-1 bg-transparent text-base outline-none" {...props} />
      <Button
        type="button"
        variant="ghost"
        className="h-11 px-2.5 text-brand"
        aria-label={shown ? 'Hide password' : 'Show password'}
        onClick={() => setShown((v) => !v)}
      >
        {shown ? 'Hide' : 'Show'}
      </Button>
    </div>
  )
})
