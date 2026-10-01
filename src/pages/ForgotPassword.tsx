import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { useAuth } from '@/hooks/useAuth'
import { authMessage } from '@/lib/authMessage'

const schema = z.object({ email: z.string().email('Enter your email address') })

const backToSignIn = (
  <Link to="/login" className="font-semibold text-brand hover:underline">
    Back to sign in
  </Link>
)

/** Ask for a link to set a new password (plan item 52). It leads to /reset-password. */
export default function ForgotPassword() {
  const { sendPasswordReset } = useAuth()
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async ({ email }: { email: string }) => {
    setError('')
    const { error } = await sendPasswordReset(email)
    if (error) setError(authMessage(error.message))
    else setSentTo(email)
  }

  if (sentTo) {
    return (
      <AuthLayout title="Check your email" footer={backToSignIn}>
        <p className="rounded-xl border bg-surface p-5 text-base leading-6">
          If there&apos;s an account for <strong className="font-semibold">{sentTo}</strong>, a link to set a new password is on
          its way. Nothing after a few minutes? Look in spam.
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a link to set a new one." footer={backToSignIn}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-email" className="mb-0 font-semibold">
            Email
          </Label>
          <Input id="reset-email" type="email" autoComplete="email" placeholder="you@example.com" className="h-[52px] text-base" {...register('email')} />
          {errors.email && <p className="text-sm text-problem">{errors.email.message}</p>}
        </div>
        {error && (
          <p role="alert" className="text-sm text-problem">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="h-[52px] w-full text-[17px]" disabled={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send the link'}
        </Button>
      </form>
    </AuthLayout>
  )
}
