/// <reference path="../pb_data/types.d.ts" />

// Links dos e-mails de confirmação e de recuperação de senha usam {APP_URL}.
// Sem o endereço do site configurado, o PocketBase usa http://localhost:8090 e o link não abre.
// Usa a variável de ambiente APP_URL quando existir; senão, o endereço publicado no Skip.
migrate(
  (app) => {
    const settings = app.settings()
    const current = (settings.meta.appURL || '').trim()
    if (!current || current.includes('localhost') || current.includes('127.0.0.1')) {
      const appUrl = ($os.getenv('APP_URL') || 'https://369training.goskip.app').replace(/\/+$/, '')
      settings.meta.appURL = appUrl
      app.save(settings)
      console.log('[0077] appURL configurado: ' + appUrl)
    }
  },
  (app) => {
    // Sem rollback: voltar para localhost quebraria os links dos e-mails.
  },
)
