/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  // Diagnóstico e teste com variações controladas para Brevo SMTP
  // Host smtp-relay.brevo.com, porta 587
  const rawPass = $os.getenv('SMTP_PASSWORD') || ''
  const cleanPass = rawPass.trim()
  const settings = app.settings()

  // Teste com authMethod PLAIN primeiro
  settings.smtp.enabled = true
  settings.smtp.host = 'smtp-relay.brevo.com'
  settings.smtp.port = 587
  settings.smtp.username = 'bd4b5d001@smtp-brevo.com'
  settings.smtp.password = cleanPass
  settings.smtp.tls = false
  settings.meta.senderName = '369WELLNESS'
  settings.meta.senderAddress = 'wellness369@outlook.com'

  // Testar PLAIN
  settings.smtp.authMethod = 'PLAIN'
  app.save(settings)

  let sent = false
  try {
    const msg = new MailerMessage({
      from: {
        address: 'wellness369@outlook.com',
        name: '369WELLNESS',
      },
      to: [{ address: 'ademariom07@gmail.com' }],
      subject: 'Teste de Configuração Brevo (PLAIN) • 369WELLNESS',
      html: '<p>Teste de envio Brevo SMTP usando authMethod PLAIN.</p>',
    })
    app.newMailClient().send(msg)
    sent = true
    console.log('[BREVO-TEST] Envio com PLAIN funcionou com sucesso!')
  } catch (errPlain) {
    console.warn('[BREVO-TEST] Erro no envio com PLAIN:', errPlain ? errPlain.message : errPlain)

    // Tentar com fallback sender no PLAIN
    try {
      const msgFallback = new MailerMessage({
        from: {
          address: 'bd4b5d001@smtp-brevo.com',
          name: '369WELLNESS',
        },
        to: [{ address: 'ademariom07@gmail.com' }],
        subject: 'Teste de Configuração Brevo Fallback (PLAIN) • 369WELLNESS',
        html: '<p>Teste de envio Brevo SMTP usando authMethod PLAIN e remetente bd4b5d001@smtp-brevo.com.</p>',
      })
      app.newMailClient().send(msgFallback)
      sent = true
      console.log('[BREVO-TEST] Envio com PLAIN + fallback sender funcionou!')
      settings.meta.senderAddress = 'bd4b5d001@smtp-brevo.com'
      app.save(settings)
    } catch (errFallback) {
      console.warn(
        '[BREVO-TEST] Erro no fallback PLAIN:',
        errFallback ? errFallback.message : errFallback,
      )
    }
  }

  // Se não funcionou com PLAIN, restaura LOGIN conforme instrução original do usuário
  if (!sent) {
    settings.smtp.authMethod = 'LOGIN'
    settings.meta.senderAddress = 'wellness369@outlook.com'
    app.save(settings)
  }
})
