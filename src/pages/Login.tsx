import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { DemoLink, GoogleButton, OrDivider, PasswordInput } from '@/components/auth/AuthParts'
import { useAuth } from '@/hooks/useAuth'
import { useCaptcha } from '@/hooks/useCaptcha'
import { useAuthOptions } from '@/hooks/useAuthOptions'
import { authMessage } from '@/lib/authMessage'

const loginSchema = z.object({
  email: z.string().email('Enter your email address'),
  password: z.string().min(1, 'Enter your password'),
})

type LoginForm = z.infer<typeof loginSchema>

/** A link from an email that didn't work comes back here with the reason in the address. */
function linkProblem(): string {
  const params = new URLSearchParams(window.location.hash.slice(1))
  if (!params.get('error')) return ''
  return params.get('error_code') === 'otp_expired'
    ? 'That link has expired or was already used. Sign in, or ask for a new one.'
    : params.get('error_description') ?? "That link didn't work. Try signing in."
}

/** Sign in (plan item 52), with Google when the project allows it. */
export default function Login() {
  const { signIn, signInWithGoogle, resendConfirmation, user } = useAuth()
  const options = useAuthOptions()
  const captcha = useCaptcha()
  const navigate = useNavigate()
  const [error, setError] = useState(linkProblem)
  const [unconfirmed, setUnconfirmed] = useState('')
  const [notice, setNotice] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  if (user) return <Navigate to="/" replace />

  const onSubmit = async (data: LoginForm) => {
    setError('')
    setNotice('')
    setUnconfirmed('')
    const { error } = await signIn(data.email, data.password, captcha.token)
    captcha.reset()
    if (error) {
      setError(authMessage(error.message))
      if (error.message.toLowerCase().includes('email not confirmed')) setUnconfirmed(data.email)
    } else {
      navigate('/')
    }
  }

  const google = async () => {
    setError('')
    const { error } = await signInWithGoogle()
    if (error) setError(authMessage(error.message))
  }

  const resend = async () => {
    const { error } = await resendConfirmation(unconfirmed, captcha.token)
    captcha.reset()
    if (error) setError(authMessage(error.message))
    else {
      setError('')
      setNotice(`We sent a new link to ${unconfirmed}.`)
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Your cheques are where you left them."
      footer={
        <>
          {options?.signUp !== false && (
            <>
              New here?{' '}
              <Link to="/signup" className="font-semibold text-brand hover:underline">
                Create an account
              </Link>
            </>
          )}
          <DemoLink options={options} />
        </>
      }
    >
      {options?.google && (
        <>
          <GoogleButton onClick={() => void google()} />
          <OrDivider />
        </>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="mb-0 font-semibold">
            Email
          </Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" className="h-[52px] text-base" {...register('email')} />
          {errors.email && <p className="text-sm text-problem">{errors.email.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password" className="mb-0 font-semibold">
              Password
            </Label>
            <Link to="/forgot-password" className="text-sm font-semibold text-brand hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput id="password" autoComplete="current-password" {...register('password')} />
          {errors.password && <p className="text-sm text-problem">{errors.password.message}</p>}
        </div>
        {error && (
          <p role="alert" className="text-sm text-problem">
            {error}{' '}
            {unconfirmed && (
              <button
                type="button"
                className="font-semibold text-brand hover:underline disabled:text-ink-quiet disabled:no-underline"
                disabled={!captcha.ready}
                onClick={() => void resend()}
              >
                Send the link again
              </button>
            )}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm text-ink-quiet">
            {notice}
          </p>
        )}
        {captcha.element}
        <Button type="submit" size="lg" className="h-[52px] w-full text-[17px]" disabled={isSubmitting || !captcha.ready}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  )
}
