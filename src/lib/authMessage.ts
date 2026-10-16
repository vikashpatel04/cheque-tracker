/** Supabase's messages, in the app's words where we know them. */
export function authMessage(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return "That email and password don't match. Try again, or reset your password."
  if (m.includes('email not confirmed')) return 'Confirm your email first: open the link we sent you.'
  if (m.includes('already registered')) return 'There is already an account with this email. Sign in instead.'
  if (m.includes('password should be at least')) return 'Use at least 8 characters for your password.'
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return "New accounts can't be created here. Ask whoever runs this copy of the app."
  // A new account refused by the database: Auth hides the reason, which is
  // most often that sign-ups are paused (migration 024).
  if (m.includes('sign-ups are paused')) return 'Sign-ups are paused for now. Sign in with the account you have, or try the demo.'
  if (m.includes('database error saving new user')) {
    return "We couldn't create a new account just now. Sign-ups may be paused: sign in with the account you have, or try the demo."
  }
  if (m.includes('rate limit') || m.includes('only request this after')) return 'Too many tries in a short time. Wait a minute, then try again.'
  if (m.includes('provider is not enabled')) return "Google sign-in isn't set up here yet. Use your email instead."
  if (m.includes('anonymous sign-ins are disabled')) return "The demo isn't available here right now."
  if (m.includes('captcha')) return "We couldn't check that you're not a robot. Try again."
  return message
}
