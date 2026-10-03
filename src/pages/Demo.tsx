import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { LegalLine } from '@/components/auth/AuthParts'
import { useAuth } from '@/hooks/useAuth'
import { useAuthOptions } from '@/hooks/useAuthOptions'
import { useCaptcha } from '@/hooks/useCaptcha'
import { startDemo } from '@/lib/demo'

const footer = (
  <>
    Ready to start for real?{' '}
    <Link to="/signup" className="font-semibold text-brand hover:underline">
      Create an account
    </Link>
    <span className="mt-2 block">
      Already have one?{' '}
      <Link to="/login" className="font-semibold text-brand hover:underline">
        Sign in
      </Link>
    </span>
  </>
)

/**
 * Try the demo (plan item 86): a private copy of the app with made-up
 * cheques, without signing up. It starts by itself once the bot check passes,
 * so the website can link straight here. Someone already signed in, or
 * already in a demo, goes to the app instead.
 */
export default function Demo() {
  const { user, loading } = useAuth()
  const options = useAuthOptions()
  const captcha = useCaptcha()
  const navigate = useNavigate()
  const starting = useRef(false)
  const [error, setError] = useState('')
  const { token, ready, reset } = captcha

  useEffect(() => {
    if (loading || user || !options?.demo || !ready || starting.current || error) return
    starting.current = true
    void startDemo(token).then((result) => {
      reset()
      if (result.error) {
        starting.current = false
        setError(result.error)
      } else {
        navigate('/', { replace: true })
      }
    })
  }, [loading, user, options, ready, token, reset, error, navigate])

  // Signing in anonymously makes `user` appear while the demo is still being filled.
  if (!loading && user && !starting.current) return <Navigate to="/" replace />

  const unavailable = options !== null && !options.demo

  return (
    <AuthLayout
      title="Try the demo"
      subtitle="A private copy of the app with made-up cheques. Look around and change anything: it's all cleared when you leave."
      footer={footer}
    >
      {unavailable ? (
        <p className="rounded-xl border bg-surface p-5 text-base leading-6">The demo isn&apos;t available here right now.</p>
      ) : error ? (
        <div className="flex flex-col gap-3 rounded-xl border bg-surface p-5">
          <p role="alert" className="text-base leading-6 text-problem">
            {error}
          </p>
          {captcha.element}
          <Button className="self-start" disabled={!ready} onClick={() => setError('')}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border bg-surface p-5">
          <p role="status" className="text-base leading-6">
            Setting up your demo…
          </p>
          {captcha.element}
        </div>
      )}
      {!unavailable && <LegalLine doing="trying the demo" />}
    </AuthLayout>
  )
}
