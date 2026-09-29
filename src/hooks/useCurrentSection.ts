import { useEffect, useState } from 'react'

/** How far below the top a section counts as the one you're reading (the desktop top bar is 68px). */
const READING_LINE = 120

/**
 * For pages with a list of sections beside them (Settings, the guide): the
 * section you're reading, the last one whose top has passed the reading line.
 * `ids` should keep its identity between renders (useMemo).
 */
export function useCurrentSection(ids: string[]) {
  const [current, setCurrent] = useState(ids[0])
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      let reading = ids[0]
      for (const id of ids) {
        const top = document.getElementById(id)?.getBoundingClientRect().top
        if (top !== undefined && top <= READING_LINE) reading = id
      }
      // At the very bottom, the last section is the one you're on, however short it is.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) reading = ids[ids.length - 1]
      setCurrent(reading)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [ids])
  return current
}

/** Scrolls smoothly to a section and puts it in the address bar, without a new history entry. */
export function goToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  window.history.replaceState(window.history.state, '', `#${id}`)
}
