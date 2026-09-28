/*
 * The service worker for the installed app. vite.config.ts builds dist/sw.js
 * from this file and fills in VERSION and PRECACHE, the files of that build.
 *
 * - Opening the app always asks the network first, so it's never stale while
 *   online. Offline, it starts from the copy saved last time.
 * - Build files have hashed names and never change, so they come from the
 *   cache first.
 * - Anything from another origin (the Supabase API, sign-in) isn't touched.
 * - A new version waits until the page asks it to take over (see
 *   src/lib/pwa.ts), so an open app never runs a mix of old and new files.
 */
const VERSION = '__VERSION__'
const PRECACHE = __PRECACHE__
const CACHE = `app-${VERSION}`
const SHELL = '/index.html'
// Build files never change under the same name, so a header like "Vary: Origin"
// (a module script sends Origin, the precache request doesn't) mustn't stop a match.
const MATCH = { ignoreVary: true }

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

async function fromNetworkFirst(request) {
  const cache = await caches.open(CACHE)
  try {
    const response = await fetch(request)
    if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
      await cache.put(SHELL, response.clone())
    }
    return response
  } catch (error) {
    const saved = await cache.match(SHELL, MATCH)
    if (saved) return saved
    throw error
  }
}

async function fromCacheFirst(request) {
  const cache = await caches.open(CACHE)
  const saved = await cache.match(request, MATCH)
  if (saved) return saved
  const response = await fetch(request)
  if (response.ok) await cache.put(request, response.clone())
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(fromNetworkFirst(request))
    return
  }
  if (url.pathname.startsWith('/assets/') || PRECACHE.includes(url.pathname)) {
    event.respondWith(fromCacheFirst(request))
  }
})
