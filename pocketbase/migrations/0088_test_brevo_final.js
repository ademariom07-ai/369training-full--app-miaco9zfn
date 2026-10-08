/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  // 1. Leitura e trim da senha fresh do ambiente
  const rawPass = $os.getenv('SMTP_PASSWORD') || ''
  const trimmedPass = rawPass.trim()

  const passLen = trimmedPass.length
  const suffix = passLen >= 6 ? trimmedPass.slice(-6) : 'SHORT'
  const prefix = passLen >= 8 ? trimmedPass.substring(0, 8) : 'SHORT'
  const expectedBrevoLen = 83 // Chaves SMTP Brevo tem tipicamente ~83 caracteres ("xsmtpsib-...")

  console.log('[BREVO-0088] Comprimento da senha lida:', passLen)
  console.log('[BREVO-0088] Sufixo (ultimos 6 chars):', suffix)
  console.log('[BREVO-0088] Prefixo seguro:', prefix === 'xsmtpsib' ? 'xsmtpsib' : prefix)
  console.log(
    '[BREVO-0088] Comparacao de comprimento:',
    'lido=' + passLen,
    'esperado_brevo~' + expectedBrevoLen,
  )

  // 2. Gravar configurações do Brevo SMTP
  const settings = app.settings()
  settings.smtp.enabled = true
  settings.smtp.host = 'smtp-relay.brevo.com'
  settings.smtp.port = 587
  settings.smtp.tls = false // STARTTLS
  settings.smtp.authMethod = 'LOGIN'
  settings.smtp.username = 'bd4b5d001@smtp-brevo.com'
  if (trimmedPass) {
    settings.smtp.password = trimmedPass
  }
  settings.meta.senderName = '369WELLNESS'
  settings.meta.senderAddress = 'wellness369@outlook.com'
  app.save(settings)

  // 3. Disparo do envio real de teste
  let sendSuccess = false
  let sendError = null

  try {
    const msg = new MailerMessage({
      from: {
        address: 'wellness369@outlook.com',
        name: '369WELLNESS',
      },
      to: [{ address: 'ademariom07@gmail.com' }],
      subject: 'Teste Brevo Final • 369WELLNESS',
      html: `
<div style="font-family: Arial, sans-serif; background-color: #0A0A0A; color: #FFFFFF; padding: 32px 20px; text-align: center;">
  <div style="max-width: 500px; margin: 0 auto; background: #141414; border: 1px solid #D4AF37; border-radius: 16px; padding: 32px;">
    <h2 style="color: #D4AF37; font-size: 22px; margin-bottom: 8px;">369WELLNESS</h2>
    <p style="color: #A3A3A3; font-size: 13px; margin-bottom: 20px;">Teste Brevo Final</p>
    <p style="font-size: 15px; color: #E5E5E5; line-height: 1.6;">
      Envio de teste SMTP Brevo concluído com sucesso.
    </p>
    <div style="margin-top: 24px; padding: 16px; background: #1F1F1F; border-radius: 8px; text-align: left; font-size: 13px; color: #CCCCCC;">
      <div>• <strong>Host:</strong> smtp-relay.brevo.com:587 (STARTTLS)</div>
      <div>• <strong>Auth:</strong> LOGIN</div>
      <div>• <strong>Username:</strong> bd4b5d001@smtp-brevo.com</div>
      <div>• <strong>Remetente:</strong> wellness369@outlook.com (369WELLNESS)</div>
      <div>• <strong>Destinatário:</strong> ademariom07@gmail.com</div>
      <div>• <strong>Senha:</strong> comprimento ${passLen}, sufixo ...${suffix}</div>
    </div>
  </div>
</div>`,
    })

    app.newMailClient().send(msg)
    sendSuccess = true
    console.log('[BREVO-0088] >>> SUCESSO no envio de teste para ademariom07@gmail.com')
  } catch (err) {
    sendSuccess = false
    sendError = err ? err.message || String(err) : 'Erro desconhecido'
    console.warn('[BREVO-0088] >>> FALHA no envio de teste:', sendError)
    console.warn(
      '[BREVO-0088] Comparacao de comprimento em caso de falha:',
      'lido=' + passLen,
      'vs esperado~' + expectedBrevoLen,
      'diferenca=' + (passLen - expectedBrevoLen),
    )
  }

  // 4. Salvar diagnóstico no platform_config
  let diagRecord = null
  try {
    diagRecord = app.findFirstRecordByData('platform_config', 'key', 'smtp_diag_last_run')
  } catch (_) {
    const col = app.findCollectionByNameOrId('platform_config')
    diagRecord = new Record(col)
    diagRecord.set('key', 'smtp_diag_last_run')
  }

  diagRecord.set('description', `Brevo 0088: len=${passLen}, suffix=${suffix}, sent=${sendSuccess}`)
  diagRecord.set('value', {
    migration: '0088_test_brevo_final',
    executed_at: new Date().toISOString(),
    password_length: passLen,
    password_suffix: suffix,
    password_prefix_xsmtpsib: prefix === 'xsmtpsib',
    expected_brevo_length: expectedBrevoLen,
    length_matches_brevo_standard: Math.abs(passLen - expectedBrevoLen) <= 5,
    sent_success: sendSuccess,
    send_error: sendError,
  })
  app.save(diagRecord)
})
