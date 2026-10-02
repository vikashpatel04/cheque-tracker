/**
 * Asking for the tour of the app (plan item 85) from anywhere, such as
 * "Show me around" on the Learn page. TourLauncher listens.
 */

const listeners = new Set<() => void>()

export function startTour() {
  listeners.forEach((listener) => listener())
}

export function onTourRequest(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The part of the screen a step points at: elements marked `data-tour="…"`. */
export type TourTarget = 'new' | 'todo' | 'nav-cheques' | 'nav-parties'

/**
 * The marked element that's on screen. Phones and desktop mark different
 * elements (the bottom tabs or the sidebar), and one of them is hidden.
 */
export function visibleTarget(target: TourTarget): HTMLElement | null {
  const marked = document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)
  return [...marked].find((el) => el.getClientRects().length > 0) ?? null
}
