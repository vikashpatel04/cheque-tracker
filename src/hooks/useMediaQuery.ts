import { useCallback, useSyncExternalStore } from 'react'

/** Whether a CSS media query matches, following changes such as a phone turned sideways. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query]
  )
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  )
}

/** Phones: below Tailwind's `sm`, where dialogs fill the screen too. */
export function useIsPhone(): boolean {
  return useMediaQuery('(max-width: 639px)')
}
