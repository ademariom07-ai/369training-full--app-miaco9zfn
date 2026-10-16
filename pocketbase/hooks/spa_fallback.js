/// <reference path="../pb_data/types.d.ts" />

/**
 * Fallback de SPA para links de e-mails em rotas do app.
 *
 * Em produção (369training.goskip.app), requisições GET para /verificar-email/...,
 * /confirmar-email/... e /redefinir-senha/... chegam ao PocketBase.
 * Como são rotas da SPA gerenciadas pelo React Router (e não arquivos físicos no disco),
 * o PocketBase respondia com 404 "File not found.".
 *
 * Este middleware intercepta requisições GET nas rotas da SPA de validação/redefinição
 * e entrega o index.html da aplicação (do filesystem ou via fetch local), permitindo
 * que o React Router carregue e leia o token da URL para validação / reset de senha.
 *
 * NUNCA interfere em:
 * - /api/*
 * - /backend/*
 * - /_*
 */

routerUse((e) => {
  const method = e.request.method
  if (method !== 'GET' && method !== 'HEAD') {
    return e.next()
  }

  const path = e.request.url.path || ''

  // Deixa passar intactas as rotas da API e do PocketBase
  if (
    path.startsWith('/api/') ||
    path.startsWith('/backend/') ||
    path.startsWith('/_/') ||
    path === '/api' ||
    path === '/backend' ||
    path === '/_'
  ) {
    return e.next()
  }

  // Verifica se é uma das rotas da SPA que precisam de fallback
  const isSpaRoute =
    path === '/verificar-email' ||
    path.startsWith('/verificar-email/') ||
    path === '/confirmar-email' ||
    path.startsWith('/confirmar-email/') ||
    path === '/redefinir-senha' ||
    path.startsWith('/redefinir-senha/')

  if (!isSpaRoute) {
    return e.next()
  }

  // Tentativa 1: Servir o index.html dos diretórios públicos se existir
  const publicDirs = ['./pb_public', 'pb_public', '../pb_public', '/pb_public', './dist', 'dist']
  for (let i = 0; i < publicDirs.length; i++) {
    try {
      const dirFs = $os.dirFS(publicDirs[i])
      const f = dirFs.open('index.html')
      if (f) {
        f.close()
        return e.fileFS(dirFs, 'index.html')
      }
    } catch (_) {}
  }

  // Tentativa 2: HTML com bootstrap que faz fetch do index.html da raiz
  const spaBootstrap = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>369WELLNESS — Foco • Legado • Estratégia</title>
    <style>
      body {
        margin: 0;
        background-color: #0A0A0A;
        color: #FFFFFF;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
      }
      .card {
        max-width: 420px;
        padding: 32px;
        background: #141414;
        border: 1px solid #D4AF37;
        border-radius: 16px;
        text-align: center;
      }
      .spin {
        width: 32px;
        height: 32px;
        border: 3px solid #333333;
        border-top-color: #D4AF37;
        border-radius: 50%;
        animation: sp 0.8s linear infinite;
        margin: 0 auto 16px auto;
      }
      @keyframes sp { to { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    <div id="spa-loader" class="card">
      <div class="spin"></div>
      <h2 style="color:#D4AF37;margin:0 0 8px 0;letter-spacing:1px;">369WELLNESS</h2>
      <p style="color:#AAA;font-size:14px;margin:0;">Carregando...</p>
    </div>
    <script>
      (async function() {
        try {
          var res = await fetch('/index.html', { cache: 'no-store' });
          if (res.ok) {
            var html = await res.text();
            document.open();
            document.write(html);
            document.close();
            return;
          }
        } catch (_) {}
      })();
    </script>
  </body>
</html>`

  return e.html(200, spaBootstrap)
})
