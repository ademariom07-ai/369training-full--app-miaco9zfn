/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  // Configuração e bateria de testes SMTP Brevo
  // 1. Obtenção do segredo do ambiente
  const envPass = $os.getenv('SMTP_PASSWORD') || ''
  const trimmedPass = envPass.trim()

  const rawLen = envPass.length
  const trimmedLen = trimmedPass.length
  const hasLeadingSpace = rawLen > 0 && envPass[0] <= ' '
  const hasTrailingSpace = rawLen > 0 && envPass[rawLen - 1] <= ' '
  const prefix =
    trimmedLen >= 6 ? trimmedLen.toString() + ':' + trimmedPass.substring(0, 6) : 'SHORT'

  console.log('[BREVO-0083] Diagnostico de Senha:')
  console.log('[BREVO-0083] raw length:', rawLen)
  console.log('[BREVO-0083] trimmed length:', trimmedLen)
  console.log('[BREVO-0083] leading space:', hasLeadingSpace)
  console.log('[BREVO-0083] trailing space:', hasTrailingSpace)
  console.log('[BREVO-0083] prefix:', prefix)

  // 2. Templates pt-BR na coleção users
  const usersCol = app.findCollectionByNameOrId('users')
  if (usersCol) {
    usersCol.verificationTemplate = {
      subject: 'Verificação de E-mail • 369WELLNESS',
      body: `
<div style="font-family: Arial, sans-serif; background-color: #0A0A0A; color: #FFFFFF; padding: 40px 20px; text-align: center;">
  <div style="max-width: 500px; margin: 0 auto; background: #141414; border: 1px solid #D4AF37; border-radius: 16px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
    <h1 style="color: #D4AF37; font-size: 24px; margin-bottom: 8px; letter-spacing: 2px;">369WELLNESS</h1>
    <p style="color: #A3A3A3; font-size: 14px; margin-bottom: 24px;">Confirmação de Cadastro</p>
    <p style="font-size: 15px; color: #E5E5E5; line-height: 1.6; margin-bottom: 28px;">
      Olá! Seja bem-vindo à plataforma <strong>369WELLNESS</strong>. Para ativar sua conta e desbloquear seu acesso aos treinos e profissionais, confirme seu e-mail clicando no botão abaixo:
    </p>
    <a href="{APP_URL}/verificar-email/{TOKEN}" style="display: inline-block; background-color: #D4AF37; color: #000000; font-weight: bold; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-size: 14px; letter-spacing: 1px;">
      CONFIRMAR MEU E-MAIL
    </a>
    <p style="color: #737373; font-size: 12px; margin-top: 32px; line-height: 1.4;">
      Se você não realizou este cadastro, desconsidere esta mensagem com segurança.<br/>
      369WELLNESS LTDA • Todos os direitos reservados.
    </p>
  </div>
</div>`,
    }

    usersCol.resetPasswordTemplate = {
      subject: 'Redefinição de Senha • 369WELLNESS',
      body: `
<div style="font-family: Arial, sans-serif; background-color: #0A0A0A; color: #FFFFFF; padding: 40px 20px; text-align: center;">
  <div style="max-width: 500px; margin: 0 auto; background: #141414; border: 1px solid #D4AF37; border-radius: 16px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
    <h1 style="color: #D4AF37; font-size: 24px; margin-bottom: 8px; letter-spacing: 2px;">369WELLNESS</h1>
    <p style="color: #A3A3A3; font-size: 14px; margin-bottom: 24px;">Redefinição de Senha</p>
    <p style="font-size: 15px; color: #E5E5E5; line-height: 1.6; margin-bottom: 28px;">
      Recebemos uma solicitação para redefinir a senha da sua conta <strong>369WELLNESS</strong>. Clique no botão abaixo para definir uma nova senha:
    </p>
    <a href="{APP_URL}/redefinir-senha/{TOKEN}" style="display: inline-block; background-color: #D4AF37; color: #000000; font-weight: bold; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-size: 14px; letter-spacing: 1px;">
      REDEFINIR MINHA SENHA
    </a>
    <p style="color: #737373; font-size: 12px; margin-top: 32px; line-height: 1.4;">
      Se você não solicitou a troca de senha, ignore este e-mail. Sua senha atual permanecerá inalterada.<br/>
      369WELLNESS LTDA • Todos os direitos reservados.
    </p>
  </div>
</div>`,
    }

    usersCol.confirmEmailChangeTemplate = {
      subject: 'Confirmação de Troca de E-mail • 369WELLNESS',
      body: `
<div style="font-family: Arial, sans-serif; background-color: #0A0A0A; color: #FFFFFF; padding: 40px 20px; text-align: center;">
  <div style="max-width: 500px; margin: 0 auto; background: #141414; border: 1px solid #D4AF37; border-radius: 16px; padding: 32px;">
    <h1 style="color: #D4AF37; font-size: 24px; margin-bottom: 8px;">369WELLNESS</h1>
    <p style="color: #E5E5E5; font-size: 15px;">Clique abaixo para confirmar a alteração de e-mail na sua conta:</p>
    <a href="{APP_URL}/confirmar-email/{TOKEN}" style="display: inline-block; background-color: #D4AF37; color: #000000; font-weight: bold; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
      CONFIRMAR NOVO E-MAIL
    </a>
  </div>
</div>`,
    }

    app.save(usersCol)
  }

  // 3. Execução da bateria das 4 variantes
  const variants = [
    { name: 'VAR_1_PORT_587_LOGIN_STARTTLS', port: 587, tls: false, authMethod: 'LOGIN' },
    { name: 'VAR_2_PORT_587_PLAIN_STARTTLS', port: 587, tls: false, authMethod: 'PLAIN' },
    { name: 'VAR_3_PORT_465_LOGIN_IMPLICIT_TLS', port: 465, tls: true, authMethod: 'LOGIN' },
    { name: 'VAR_4_PORT_465_PLAIN_IMPLICIT_TLS', port: 465, tls: true, authMethod: 'PLAIN' },
  ]

  let winningVariant = null
  const testResults = []

  for (let i = 0; i < variants.length; i++) {
    const v = variants[i]
    console.log(
      '[BREVO-TEST] Variante:',
      v.name,
      'porta:',
      v.port,
      'tls:',
      v.tls,
      'auth:',
      v.authMethod,
    )

    const settings = app.settings()
    settings.smtp.enabled = true
    settings.smtp.host = 'smtp-relay.brevo.com'
    settings.smtp.port = v.port
    settings.smtp.username = 'bd4b5d001@smtp-brevo.com'
    if (trimmedPass) {
      settings.smtp.password = trimmedPass
    }
    settings.smtp.authMethod = v.authMethod
    settings.smtp.tls = v.tls
    settings.meta.senderName = '369WELLNESS'
    settings.meta.senderAddress = 'wellness369@outlook.com'
    app.save(settings)

    try {
      const msg = new MailerMessage({
        from: {
          address: 'wellness369@outlook.com',
          name: '369WELLNESS',
        },
        to: [{ address: 'ademariom07@gmail.com' }],
        subject: `Teste Brevo SMTP [${v.name}] • 369WELLNESS`,
        html: `
<div style="font-family: Arial, sans-serif; background-color: #0A0A0A; color: #FFFFFF; padding: 32px 20px; text-align: center;">
  <div style="max-width: 500px; margin: 0 auto; background: #141414; border: 1px solid #D4AF37; border-radius: 16px; padding: 32px;">
    <h2 style="color: #D4AF37; font-size: 22px; margin-bottom: 8px;">369WELLNESS</h2>
    <p style="color: #A3A3A3; font-size: 13px; margin-bottom: 20px;">Teste de Transmissão SMTP Brevo</p>
    <p style="font-size: 15px; color: #E5E5E5; line-height: 1.6;">
      Sucesso na transmissão via <strong>${v.name}</strong>!
    </p>
    <div style="margin-top: 24px; padding: 16px; background: #1F1F1F; border-radius: 8px; text-align: left; font-size: 13px; color: #CCCCCC;">
      <div>• <strong>Host:</strong> smtp-relay.brevo.com:${v.port} (TLS: ${v.tls})</div>
      <div>• <strong>Auth:</strong> ${v.authMethod}</div>
      <div>• <strong>Username:</strong> bd4b5d001@smtp-brevo.com</div>
      <div>• <strong>Sender:</strong> wellness369@outlook.com</div>
      <div>• <strong>Destinatário:</strong> ademariom07@gmail.com</div>
    </div>
  </div>
</div>`,
      })

      app.newMailClient().send(msg)
      console.log('[BREVO-TEST] >>> SUCESSO na variante:', v.name)
      testResults.push({ variant: v.name, success: true })
      winningVariant = v
      break
    } catch (testErr) {
      const errMsg = testErr ? testErr.message || String(testErr) : 'Erro desconhecido'
      console.warn('[BREVO-TEST] >>> FALHA na variante', v.name, ':', errMsg)
      testResults.push({ variant: v.name, success: false, error: errMsg })
    }
  }

  // 4. Persistir configuração final
  const finalSettings = app.settings()
  finalSettings.smtp.enabled = true
  finalSettings.smtp.host = 'smtp-relay.brevo.com'
  finalSettings.smtp.username = 'bd4b5d001@smtp-brevo.com'
  if (trimmedPass) {
    finalSettings.smtp.password = trimmedPass
  }
  finalSettings.meta.senderName = '369WELLNESS'
  finalSettings.meta.senderAddress = 'wellness369@outlook.com'

  if (winningVariant) {
    console.log('[BREVO-FINAL] Gravando variante vitoriosa:', winningVariant.name)
    finalSettings.smtp.port = winningVariant.port
    finalSettings.smtp.authMethod = winningVariant.authMethod
    finalSettings.smtp.tls = winningVariant.tls
  } else {
    console.warn('[BREVO-FINAL] Persistindo configuração oficial (porta 587, LOGIN, STARTTLS)')
    finalSettings.smtp.port = 587
    finalSettings.smtp.authMethod = 'LOGIN'
    finalSettings.smtp.tls = false
  }
  app.save(finalSettings)

  // 5. Registrar resultado
  let diagRecord = null
  try {
    diagRecord = app.findFirstRecordByData('platform_config', 'key', 'smtp_diag_last_run')
  } catch (_) {
    const col = app.findCollectionByNameOrId('platform_config')
    diagRecord = new Record(col)
    diagRecord.set('key', 'smtp_diag_last_run')
  }

  diagRecord.set('description', 'Diagnostico da execucao de migracao SMTP Brevo 0083')
  diagRecord.set('value', {
    executed_at: new Date().toISOString(),
    raw_length: rawLen,
    trimmed_length: trimmedLen,
    has_leading_space: hasLeadingSpace,
    has_trailing_space: hasTrailingSpace,
    prefix: prefix,
    winning_variant: winningVariant ? winningVariant.name : null,
    test_results: testResults,
  })
  app.save(diagRecord)
})
