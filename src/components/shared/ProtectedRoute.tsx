import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { hash, search } = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!user) {
    // A link from an email, or a Google sign-in, that failed carries the reason
    // in the hash or the query; sign-in shows it.
    return <Navigate to={{ pathname: '/login', search, hash }} replace />
  }

  return <>{children}</>
}
