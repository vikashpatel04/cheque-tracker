import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useCloseOnBack } from '@/hooks/useCloseOnBack'
import { visibleTarget, type TourTarget } from '@/lib/tour'
import { cn } from '@/lib/utils'

interface Step {
  /** What it points at; none for the last step, which sits in the middle. */
  target?: TourTarget
  title: string
  text: string
}

const STEPS: Step[] = [
  {
    target: 'new',
    title: 'Add from here',
    text: 'A cheque you give or receive, a series such as rent, or several at once. Add funds is here too.',
  },
  {
    target: 'todo',
    title: "Today's to-dos",
    text: 'What to deposit, fund or check today. Each one has its next step as a button.',
  },
  {
    target: 'nav-cheques',
    title: 'Every cheque',
    text: 'Given and received, in one list. Filter, search, and mark several at once.',
  },
  {
    target: 'nav-parties',
    title: 'Parties',
    text: 'Everyone you exchange cheques with: what you still have to pay them, and what they still owe you.',
  },
  {
    title: "That's the tour",
    text: 'Want to know how clearing, bounces and post-dated cheques work? The guide explains, in plain words.',
  },
]

/** Space between the screen's edge, the highlight and the card. */
const GAP = 16
const PAD = 6
/** A taller target (Today's to-dos) is highlighted from its top, this share of the screen at most. */
const MAX_SPOT = 0.42
/** Where a tall target's top goes: clear of the desktop's top bar. */
const TOP_CLEARANCE = 88

interface Box {
  top: number
  left: number
  width: number
  height: number
}

/**
 * The tour (plan item 85): a few cards, each pointing at a part of the screen,
 * with the rest dimmed. Lazy-loaded by TourLauncher; nothing here runs unless
 * the tour is open. Escape, Skip and the phone's back button end it.
 */
export default function Tour({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [index, setIndex] = useState(0)
  const [spot, setSpot] = useState<Box | null>(null)
  const [cardTop, setCardTop] = useState<number | null>(null)
  const card = useRef<HTMLDivElement>(null)
  const primary = useRef<HTMLButtonElement>(null)
  const step = STEPS[index]
  const last = index === STEPS.length - 1

  useCloseOnBack(true, onClose)

  // The to-dos are on Today, so the tour starts there.
  useEffect(() => {
    if (pathname !== '/') navigate('/')
    // Only when the tour opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Find this step's target, bring it into view, and keep the highlight on it.
  const measure = useCallback(() => {
    const el = step.target ? visibleTarget(step.target) : null
    if (!el) {
      setSpot(null)
      return
    }
    const r = el.getBoundingClientRect()
    const height = Math.min(r.height, window.innerHeight * MAX_SPOT)
    setSpot({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: height + PAD * 2 })
  }, [step.target])

  useEffect(() => {
    // Wait a frame, so Today has rendered after navigating to it.
    const frame = requestAnimationFrame(() => {
      const el = step.target ? visibleTarget(step.target) : null
      if (el) {
        const r = el.getBoundingClientRect()
        if (r.height > window.innerHeight * MAX_SPOT) window.scrollBy({ top: r.top - TOP_CLEARANCE })
        else el.scrollIntoView({ block: 'center' })
      }
      measure()
    })
    let pending = 0
    const remeasure = () => {
      cancelAnimationFrame(pending)
      pending = requestAnimationFrame(measure)
    }
    window.addEventListener('resize', remeasure)
    window.addEventListener('scroll', remeasure, true)
    return () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(pending)
      window.removeEventListener('resize', remeasure)
      window.removeEventListener('scroll', remeasure, true)
    }
  }, [step.target, measure, pathname])

  // Put the card below the highlight, or above it when there isn't room.
  useLayoutEffect(() => {
    const height = card.current?.offsetHeight ?? 0
    if (!spot) {
      setCardTop(null)
      return
    }
    const below = spot.top + spot.height + 12
    setCardTop(below + height <= window.innerHeight - GAP ? below : Math.max(GAP, spot.top - 12 - height))
  }, [spot, index])

  useEffect(() => {
    primary.current?.focus()
  }, [index])

  // Esc ends the tour. Cancelling it keeps the browser from also treating it
  // as Back (useCloseOnBack), which would end it twice.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const width = Math.min(360, window.innerWidth - GAP * 2)
  const left = spot
    ? Math.min(Math.max(spot.left + spot.width / 2 - width / 2, GAP), window.innerWidth - width - GAP)
    : (window.innerWidth - width) / 2

  return (
    <div className="fixed inset-0 z-[60]" role="presentation">
      {spot ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-xl shadow-[0_0_0_9999px_var(--scrim)] ring-2 ring-brand transition-all duration-200 motion-reduce:transition-none"
          style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
        />
      ) : (
        <div aria-hidden="true" className="fixed inset-0 bg-scrim" />
      )}

      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-text"
        className={cn(
          'fixed flex flex-col gap-3 rounded-xl border bg-surface p-4 shadow-pop',
          !spot && 'top-1/2 -translate-y-1/2'
        )}
        style={{ width, left, ...(spot && cardTop !== null ? { top: cardTop } : {}) }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="tour-title" className="text-[17px] font-semibold">
            {step.title}
          </h2>
          <span className="shrink-0 text-[13px] text-ink-quiet">
            {index + 1} of {STEPS.length}
          </span>
        </div>
        <p id="tour-text" className="text-[15px] leading-[22px] text-ink-quiet">
          {step.text}
        </p>
        {last ? (
          <div className="flex flex-col gap-2 pt-1">
            <Button
              ref={primary}
              onClick={() => {
                onClose()
                navigate('/learn')
              }}
            >
              Learn how cheques work
            </Button>
            <Button variant="outline" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 pt-1">
            <Button variant="ghost" className="px-2 text-ink-quiet" onClick={onClose}>
              Skip
            </Button>
            <div className="flex gap-2">
              {index > 0 && (
                <Button variant="outline" onClick={() => setIndex(index - 1)}>
                  Back
                </Button>
              )}
              <Button ref={primary} onClick={() => setIndex(index + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
