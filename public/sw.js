const CACHE_NAME = 'visiontrace-v1'
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/sw.js',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  if (event.request.url.includes('opencv.org') || event.request.url.includes('fonts.googleapis.com') || event.request.url.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response('', { status: 503 }))
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/')
        }
        return new Response('', { status: 503 })
      })
    })
  )
})
