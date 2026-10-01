import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MailCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { GoogleButton, OrDivider, PasswordInput } from '@/components/auth/AuthParts'
import { useAuth } from '@/hooks/useAuth'
import { useAuthOptions } from '@/hooks/useAuthOptions'
import { authMessage } from '@/lib/authMessage'

const signupSchema = z.object({
  email: z.string().email('Enter your email address'),
  password: z.string().min(8, 'Use at least 8 characters'),
})

type SignupForm = z.infer<typeof signupSchema>

const signInLink = (
  <>
    Already have an account?{' '}
    <Link to="/login" className="font-semibold text-brand hover:underline">
      Sign in
    </Link>
  </>
)

/**
 * Create an account (plan item 52; the Signup-phone board), with email or
 * Google. With email confirmation on, it ends on "Check your email".
 */
export default function Signup() {
  const { signUp, signInWithGoogle, resendConfirmation, user } = useAuth()
  const options = useAuthOptions()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [resent, setResent] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  })

  if (user) return <Navigate to="/" replace />

  const onSubmit = async (data: SignupForm) => {
    setError('')
    const { session, error } = await signUp(data.email, data.password)
    if (error) setError(authMessage(error.message))
    else if (session) navigate('/')
    else setSentTo(data.email)
  }

  const google = async () => {
    setError('')
    const { error } = await signInWithGoogle()
    if (error) setError(authMessage(error.message))
  }

  const resend = async () => {
    const { error } = await resendConfirmation(sentTo)
    if (error) setError(authMessage(error.message))
    else setResent(true)
  }

  if (sentTo) {
    return (
      <AuthLayout title="Check your email" footer={signInLink}>
        <div className="flex flex-col gap-4 rounded-xl border bg-surface p-5">
          <MailCheck className="h-8 w-8 text-brand" aria-hidden="true" />
          <p className="text-base leading-6">
            We sent a link to <strong className="font-semibold">{sentTo}</strong>. Open it to finish creating your account.
          </p>
          <p className="text-sm text-ink-quiet">
            Nothing after a few minutes? Look in spam. If you already have an account with this email, sign in or reset your
            password instead.
          </p>
          {error && (
            <p role="alert" className="text-sm text-problem">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void resend()} disabled={resent}>
              {resent ? 'Sent again' : 'Send it again'}
            </Button>
            <Button
              variant="ghost"
              className="text-brand"
              onClick={() => {
                setSentTo('')
                setResent(false)
                setError('')
              }}
            >
              Use another email
            </Button>
          </div>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Create your account" subtitle="For the cheques you give and the cheques you receive." footer={signInLink}>
      {options?.signUp === false ? (
        <p className="rounded-xl border bg-surface p-5 text-base leading-6">
          New accounts can&apos;t be created here. Ask whoever runs this copy of the app to add you.
        </p>
      ) : (
        <>
          {options?.google && (
            <>
              <GoogleButton onClick={() => void google()} />
              <OrDivider />
            </>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="su-email" className="mb-0 font-semibold">
                Email
              </Label>
              <Input id="su-email" type="email" autoComplete="email" placeholder="you@example.com" className="h-[52px] text-base" {...register('email')} />
              {errors.email && <p className="text-sm text-problem">{errors.email.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="su-password" className="mb-0 font-semibold">
                Password
              </Label>
              <PasswordInput id="su-password" autoComplete="new-password" {...register('password')} />
              {errors.password ? (
                <p className="text-sm text-problem">{errors.password.message}</p>
              ) : (
                <span className="text-[13px] text-ink-quiet">At least 8 characters</span>
              )}
            </div>
            {error && (
              <p role="alert" className="text-sm text-problem">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="h-[52px] w-full text-[17px]" disabled={isSubmitting}>
              {isSubmitting ? 'Creating your account…' : 'Create account'}
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  )
}
