// Registra o app instalável (PWA) nas páginas estáticas do site.
if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) })
