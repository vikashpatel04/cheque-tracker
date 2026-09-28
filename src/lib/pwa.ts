import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'

/**
 * The installed app (PWA): the service worker, updates, installing, and
 * whether the device is online. The worker itself is pwa/service-worker.js.
 */

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Chrome and Edge's install prompt, which isn't in the DOM types yet. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let installPrompt: InstallPromptEvent | null = null

/** Registers the service worker in production builds and offers new versions. */
export function registerServiceWorker() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    installPrompt = event as InstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    installPrompt = null
    notify()
  })
  window.addEventListener('online', notify)
  window.addEventListener('offline', notify)

  if (!('serviceWorker' in navigator)) return
  if (!import.meta.env.PROD) {
    // The dev server has no service worker. Remove one left by an older build.
    void navigator.serviceWorker.getRegistrations().then((all) => all.forEach((r) => void r.unregister()))
    return
  }

  const hadController = !!navigator.serviceWorker.controller
  let reloadAsked = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadAsked) {
      window.location.reload()
    } else if (hadController) {
      // Another window took the new version: this one is out of date.
      toast('This app was updated in another window.', {
        duration: Infinity,
        action: { label: 'Reload', onClick: () => window.location.reload() },
      })
    }
  })

  const offer = (worker: ServiceWorker) =>
    toast('A new version is ready.', {
      duration: Infinity,
      action: {
        label: 'Reload',
        onClick: () => {
          reloadAsked = true
          worker.postMessage('SKIP_WAITING')
        },
      },
    })

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) offer(registration.waiting)
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(worker)
          })
        })
        // An installed app can stay open for days, so look for a new version when it comes back.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void registration.update().catch(() => {})
        })
      })
      .catch(() => {
        // Without a worker the app still runs; it just can't start offline.
      })
  })
}

/** Whether the app runs installed, in its own window. */
export function isInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** iPhones and iPads install from Safari's Share menu; there's no prompt to show. */
export function installsFromShareMenu(): boolean {
  const ua = navigator.userAgent
  const iPad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return (/iPhone|iPad|iPod/.test(ua) || iPad) && !isInstalled()
}

export type InstallOption = 'prompt' | 'share-menu' | null

function installOption(): InstallOption {
  if (installPrompt) return 'prompt'
  return installsFromShareMenu() ? 'share-menu' : null
}

/** How this device can install the app, if it isn't installed yet. */
export function useInstallOption(): InstallOption {
  return useSyncExternalStore(subscribe, installOption)
}

/** Shows the browser's install prompt. */
export async function promptInstall() {
  const prompt = installPrompt
  if (!prompt) return
  await prompt.prompt()
  await prompt.userChoice
  installPrompt = null
  notify()
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine)
}
