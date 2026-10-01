import { useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/** An address in this app, for links in emails and for coming back from Google. */
const backTo = (path: string) => `${window.location.origin}${path}`

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // captchaToken: from useCaptcha, when the bot check is on (components/auth/Captcha.tsx).
  const signIn = async (email: string, password: string, captchaToken?: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } })
    return { error }
  }

  /** A new account. With email confirmation on, there's no session until the link is opened. */
  const signUp = async (email: string, password: string, captchaToken?: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: backTo('/'), captchaToken } })
    return { session: data.session, error }
  }

  /** Leaves for Google's sign-in, which comes back to Today. */
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: backTo('/') } })
    return { error }
  }

  /** Sends the confirmation link again. */
  const resendConfirmation = async (email: string, captchaToken?: string) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: backTo('/'), captchaToken } })
    return { error }
  }

  /** Emails a link to /reset-password. */
  const sendPasswordReset = async (email: string, captchaToken?: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: backTo('/reset-password'), captchaToken })
    return { error }
  }

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return { user, session, loading, signIn, signUp, signInWithGoogle, resendConfirmation, sendPasswordReset, updatePassword, signOut }
}
