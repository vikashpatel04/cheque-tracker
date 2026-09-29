import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { AppLogo } from '@/components/shared/AppLogo'
import { SourceLink } from '@/components/shared/SourceLink'
import { brand } from '@/config/brand'

const loginSchema = z.object({
  email: z.string().email('Enter your email address'),
  password: z.string().min(6, 'At least 6 characters'),
})

type LoginForm = z.infer<typeof loginSchema>

/**
 * Sign in, in the look of the Signup-phone board. Creating an account,
 * resetting a password and Google come with plan item 52.
 */
export default function Login() {
  const { signIn, user } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  if (user) {
    navigate('/')
    return null
  }

  const onSubmit = async (data: LoginForm) => {
    setError('')
    const { error } = await signIn(data.email, data.password)
    if (error) {
      setError(error.message)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col gap-[22px] px-5 pb-6 pt-9 sm:justify-center">
        <AppLogo size="sm" />

        <div className="flex flex-col gap-2.5">
          <h1 className="font-title text-[30px] leading-[38px]">{brand.tagline}</h1>
          <p className="text-base leading-6 text-ink-quiet">For the cheques you give and the cheques you receive.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email" className="mb-0 font-semibold">
              Email
            </Label>
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" className="h-[52px] text-base" {...register('email')} />
            {errors.email && <p className="text-sm text-problem">{errors.email.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password" className="mb-0 font-semibold">
              Password
            </Label>
            <div className="flex h-[52px] items-center rounded-md border border-input bg-surface pl-3.5 pr-1.5 focus-within:ring-2 focus-within:ring-ring/40">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="min-w-0 flex-1 bg-transparent text-base outline-none"
                {...register('password')}
              />
              <Button type="button" variant="ghost" className="h-11 px-2.5 text-brand" onClick={() => setShowPassword((v) => !v)}>
                {showPassword ? 'Hide' : 'Show'}
              </Button>
            </div>
            {errors.password && <p className="text-sm text-problem">{errors.password.message}</p>}
          </div>
          {error && (
            <p role="alert" className="text-sm text-problem">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="h-[52px] w-full text-[17px]" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <div className="flex-1 sm:flex-none" />
        <SourceLink className="text-center text-[13px] text-ink-quiet" />
      </div>
    </div>
  )
}
