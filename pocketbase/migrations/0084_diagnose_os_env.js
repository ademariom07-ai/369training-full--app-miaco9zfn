/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  // Diagnóstico das propriedades e métodos disponíveis em $os
  let osKeys = []
  try {
    osKeys = Object.keys($os)
  } catch (e) {
    osKeys = ['error: ' + e]
  }

  // Verificar se há variáveis no ambiente do Go process
  let allEnvStr = ''
  try {
    if ($os.environ) {
      allEnvStr = JSON.stringify($os.environ())
    }
  } catch (e) {
    allEnvStr = 'environ_err: ' + e
  }

  // Verificar se app.settings() tem smtp.password pré-existente
  const settings = app.settings()
  const storedSmtpPass = settings.smtp.password || ''
  const storedLen = storedSmtpPass.length
  const storedPrefix =
    storedLen >= 6
      ? storedLen.toString() + ':' + storedSmtpPass.substring(0, 6)
      : storedLen > 0
        ? storedLen.toString()
        : 'EMPTY'

  let diagRecord = null
  try {
    diagRecord = app.findFirstRecordByData('platform_config', 'key', 'smtp_diag_last_run')
  } catch (_) {
    const col = app.findCollectionByNameOrId('platform_config')
    diagRecord = new Record(col)
    diagRecord.set('key', 'smtp_diag_last_run')
  }

  diagRecord.set('description', 'Diagnostico do ambiente Go/JSVM em 0084')
  diagRecord.set('value', {
    executed_at: new Date().toISOString(),
    os_keys: osKeys,
    has_environ: allEnvStr.substring(0, 100),
    stored_smtp_pass_len: storedLen,
    stored_smtp_prefix: storedPrefix,
    current_smtp_host: settings.smtp.host,
    current_smtp_user: settings.smtp.username,
    current_smtp_port: settings.smtp.port,
    current_smtp_auth: settings.smtp.authMethod,
  })
  app.save(diagRecord)
})
