import { useEffect } from 'react'

/**
 * A change made in one place (the New menu, search, a dialog) refreshes the
 * lists shown everywhere else. Whoever saves calls announceDataChange; data
 * hooks refetch with useDataChanges.
 */
const EVENT = 'app:data-changed'

export function announceDataChange() {
  window.dispatchEvent(new Event(EVENT))
}

export function useDataChanges(refetch: () => void) {
  useEffect(() => {
    const listener = () => refetch()
    window.addEventListener(EVENT, listener)
    return () => window.removeEventListener(EVENT, listener)
  }, [refetch])
}
