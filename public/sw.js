// Service worker do app instalável (PWA) do 369WELLNESS.
// - Páginas: busca sempre na rede primeiro (cada publicação no Skip chega na hora);
//   sem internet, abre a última versão salva do app.
// - Arquivos de /assets/ (nomes com hash, nunca mudam) e ícones: cache primeiro.
// - Nada de API, login ou dados do usuário é guardado em cache.
const CACHE = '369wellness-v1'
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll(APP_SHELL)
      // Guarda também os arquivos principais citados no index.html (JS e CSS do build),
      // para o app abrir sem internet já depois da primeira visita.
      try {
        const html = await (await fetch('/', { cache: 'no-store' })).text()
        const assets = [...new Set(html.match(/\/assets\/[^"'\s)]+/g) || [])]
        await cache.addAll(assets)
      } catch (_) {
        // Sem problema: os arquivos entram no cache quando forem usados
      }
    }),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (/^\/(api|pb|backend|_)\//.test(url.pathname)) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((cache) => cache.put('/', copy))
          }
          return res
        })
        .catch(() =>
          caches.match('/').then(
            (cached) =>
              cached ||
              new Response('Sem conexão com a internet. Tente novamente em instantes.', {
                status: 503,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
              }),
          ),
        ),
    )
    return
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((cache) => cache.put(req, copy))
            }
            return res
          }),
      ),
    )
  }
})
