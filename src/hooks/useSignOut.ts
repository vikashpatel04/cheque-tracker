import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { resetActivity } from '@/hooks/useActivity'
import { resetTodayData } from '@/hooks/useTodayData'

/** Signs out and goes to the sign-in page. */
export function useSignOut() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  return async () => {
    await signOut()
    resetActivity()
    resetTodayData()
    navigate('/login')
  }
}
