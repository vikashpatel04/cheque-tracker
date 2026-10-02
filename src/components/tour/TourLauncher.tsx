import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { useSettings } from '@/hooks/useSettings'
import { useSetupStatus } from '@/hooks/useSetupStatus'
import { onTourRequest } from '@/lib/tour'

// The tour downloads only when it's about to show.
const Tour = lazy(() => import('@/components/tour/Tour'))

/** How often to look whether the dialog that added the first cheque has closed. */
const WAIT_MS = 800

/**
 * Starts the tour once the first cheque is in, as soon as no dialog is open
 * (the form that added it, say). Only mounted while the tour hasn't been
 * done, so other accounts pay nothing for it.
 */
function AfterFirstCheque({ onReady }: { onReady: () => void }) {
  const { loading, hasCheques } = useSetupStatus()

  useEffect(() => {
    if (loading || !hasCheques) return
    const timer = setInterval(() => {
      if (!document.querySelector('[role="dialog"], [role="alertdialog"]')) {
        clearInterval(timer)
        onReady()
      }
    }, WAIT_MS)
    return () => clearInterval(timer)
  }, [loading, hasCheques, onReady])

  return null
}

/**
 * The short tour of the app (plan item 85): once, after the first cheque, and
 * again whenever someone asks for it (`startTour`, e.g. on the Learn page).
 * Finishing or skipping it is remembered in `settings.tour_done_at`.
 */
export function TourLauncher() {
  const { settings, updateSettings } = useSettings()
  const [open, setOpen] = useState(false)
  const pending = settings.tour_done_at === null

  useEffect(() => onTourRequest(() => setOpen(true)), [])

  const show = useCallback(() => setOpen(true), [])

  const close = useCallback(() => {
    setOpen(false)
    if (pending) void updateSettings({ tour_done_at: new Date().toISOString() })
  }, [pending, updateSettings])

  return (
    <>
      {pending && !open && <AfterFirstCheque onReady={show} />}
      {open && (
        <Suspense fallback={null}>
          <Tour onClose={close} />
        </Suspense>
      )}
    </>
  )
}
