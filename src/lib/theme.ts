import { useSyncExternalStore } from 'react'

/**
 * Light or dark look, chosen per device. "system" follows the device setting.
 * index.html applies the saved choice before the first paint; keep the two in
 * step.
 */
export type ThemeChoice = 'system' | 'light' | 'dark'

const KEY = 'theme'
const listeners = new Set<() => void>()

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

export function getThemeChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch {
    return 'system'
  }
}

function apply(choice: ThemeChoice) {
  const root = document.documentElement
  root.classList.toggle('dark', choice === 'dark' || (choice === 'system' && darkQuery().matches))
  // The browser bar and the installed app's title bar take the paper colour.
  const ground = getComputedStyle(root).getPropertyValue('--ground').trim()
  if (ground) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', ground)
}

export function setThemeChoice(choice: ThemeChoice) {
  try {
    if (choice === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, choice)
  } catch {
    // Private browsing: the choice lasts until the page closes.
  }
  apply(choice)
  listeners.forEach((listener) => listener())
}

/** Applies the saved choice and follows the device while the choice is "system". */
export function initTheme() {
  apply(getThemeChoice())
  darkQuery().addEventListener('change', () => {
    if (getThemeChoice() === 'system') apply('system')
  })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, getThemeChoice)
}
