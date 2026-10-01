import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { PasswordInput } from '@/components/auth/AuthParts'
import { useAuth } from '@/hooks/useAuth'
import { authMessage } from '@/lib/authMessage'

const schema = z.object({ password: z.string().min(8, 'Use at least 8 characters') })

/**
 * Where the reset email leads (plan item 52). Opening its link signs you in
 * for this, then you choose a new password.
 */
export default function ResetPassword() {
  const { user, loading, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ password: string }>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async ({ password }: { password: string }) => {
    setError('')
    const { error } = await updatePassword(password)
    if (error) {
      setError(authMessage(error.message))
      return
    }
    toast.success('Your password is changed')
    navigate('/')
  }

  if (loading) return <AuthLayout title="Set a new password">{null}</AuthLayout>

  if (!user) {
    return (
      <AuthLayout
        title="This link has expired"
        footer={
          <Link to="/login" className="font-semibold text-brand hover:underline">
            Back to sign in
          </Link>
        }
      >
        <p className="rounded-xl border bg-surface p-5 text-base leading-6">
          Links to reset a password work once, for a short time.{' '}
          <Link to="/forgot-password" className="font-semibold text-brand hover:underline">
            Ask for a new one
          </Link>
          .
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Set a new password" subtitle={`For ${user.email}.`}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-password" className="mb-0 font-semibold">
            New password
          </Label>
          <PasswordInput id="new-password" autoComplete="new-password" autoFocus {...register('password')} />
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
          {isSubmitting ? 'Saving…' : 'Save the new password'}
        </Button>
      </form>
    </AuthLayout>
  )
}
