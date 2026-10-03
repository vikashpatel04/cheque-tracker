import { useAuth } from '@/hooks/useAuth'

/**
 * Signs out (in the demo, ends it), then loads the sign-in page, or `to`,
 * afresh. Nothing the account loaded stays in memory, and the route guard
 * can't send the page elsewhere first.
 */
export function useSignOut() {
  const { signOut } = useAuth()
  return async (to = '/login') => {
    await signOut()
    window.location.replace(to)
  }
}
