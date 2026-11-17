// 369 WELLNESS · Service worker do app instalado (PWA).
// - Páginas: sempre busca a versão mais nova na rede; sem internet, mostra /offline.html.
// - Arquivos com versão no nome (/access-assets) e imagens da marca: guardados no aparelho.
// - Nunca guarda nada de outros endereços (Supabase, YouTube): dados e login sempre online.
const VERSION = 'v1'
const STATIC = '369-static-' + VERSION
const PRECACHE = ['/offline.html', '/brand.css', '/assets/pwa/icon-192.png', '/assets/brand/logo-primary.png']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(STATIC).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith('369-') && key !== STATIC).map(key => caches.delete(key))))
    .then(() => self.clients.claim()))
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')))
    return
  }
  if (url.pathname.startsWith('/access-assets/') || url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(STATIC).then(cache => cache.put(request, copy)) }
      return response
    })))
  }
})
