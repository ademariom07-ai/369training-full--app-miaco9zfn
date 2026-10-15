/// <reference path="../pb_data/types.d.ts" />

// Configuration of Brevo SMTP & Custom Email Templates for 369WELLNESS
// Reads SMTP password from $os.getenv('SMTP_PASSWORD')

// Garante configuração no boot do PocketBase
onBootstrap((e) => {
  e.next()
  try {
    let rawPass = $os.getenv('SMTP_PASSWORD') || ''
    if (!rawPass && typeof $secrets !== 'undefined' && $secrets.has('SMTP_PASSWORD')) {
      rawPass = $secrets.get('SMTP_PASSWORD') || ''
    }
    const smtpPass = rawPass.trim()

    // Se o segredo SMTP_PASSWORD não existir no ambiente, NÃO tocar nas mailer settings
    // existentes (nem apagar, nem sobrescrever com vazio) — preservar o que está salvo no painel.
    if (!smtpPass) {
      console.log(
        '[SMTP_BOOT] Segredo SMTP_PASSWORD não configurado no ambiente. Preservando configurações SMTP existentes do painel.',
      )
      return
    }

    const settings = e.app.settings()

    settings.smtp.enabled = true
    settings.smtp.host = 'smtp-relay.brevo.com'
    settings.smtp.port = 587
    settings.smtp.authMethod = 'LOGIN'
    settings.smtp.tls = false // PocketBase usa STARTTLS na porta 587 quando tls é false
    settings.smtp.username = 'bd4b5d001@smtp-brevo.com'
    settings.smtp.password = smtpPass
    settings.meta.senderName = '369WELLNESS'
    settings.meta.senderAddress = 'wellness369@outlook.com'

    e.app.save(settings)

    const suffix = smtpPass.length >= 6 ? smtpPass.slice(-6) : 'SHORT'
    console.log(
      '[SMTP_BOOT] Brevo settings aplicadas no boot. Pass len:',
      smtpPass.length,
      'suffix:',
      suffix,
    )
  } catch (err) {
    console.error('[SMTP_BOOT] Erro ao aplicar Brevo settings no boot:', err)
  }
})

routerAdd(
  'POST',
  '/backend/v1/auth/test-smtp',
  (c) => {
    try {
      const authUser = c.auth
      if (!authUser || authUser.getString('role') !== 'admin') {
        return c.json(403, { success: false, message: 'Acesso restrito ao administrador.' })
      }

      let rawPass = $os.getenv('SMTP_PASSWORD') || ''
      if (!rawPass && typeof $secrets !== 'undefined' && $secrets.has('SMTP_PASSWORD')) {
        rawPass = $secrets.get('SMTP_PASSWORD') || ''
      }
      const smtpPass = rawPass.trim()
      const hasLeading = rawPass.length > 0 && rawPass[0] <= ' '
      const hasTrailing = rawPass.length > 0 && rawPass[rawPass.length - 1] <= ' '
      const prefix = smtpPass.length >= 6 ? smtpPass.substring(0, 6) : 'SHORT'

      console.log(
        '[SMTP_TEST_HOOK] pass raw len:',
        rawPass.length,
        'trimmed len:',
        smtpPass.length,
        'leading:',
        hasLeading,
        'trailing:',
        hasTrailing,
        'prefix:',
        prefix,
      )

      const settings = $app.settings()
      settings.smtp.enabled = true
      settings.smtp.host = 'smtp-relay.brevo.com'
      settings.smtp.port = 587
      settings.smtp.authMethod = 'LOGIN'
      settings.smtp.tls = false
      settings.smtp.username = 'bd4b5d001@smtp-brevo.com'
      if (smtpPass) {
        settings.smtp.password = smtpPass
      }
      settings.meta.senderName = '369WELLNESS'
      settings.meta.senderAddress = 'wellness369@outlook.com'
      $app.save(settings)

      // Atualizar templates na coleção users
      const usersCol = $app.findCollectionByNameOrId('users')
      if (usersCol) {
        usersCol.verificationTemplate = {
          subject: 'Verificação de E-mail • 369WELLNESS',
          body: `
<div style="font-family: Arial, sans-serif; background-color: #0A0A0A; color: #FFFFFF; padding: 40px 20px; text-align: center;">
  <div style="max-width: 500px; margin: 0 auto; background: #141414; border: 1px solid #D4AF37; border-radius: 16px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
    <h1 style="color: #D4AF37; font-size: 24px; margin-bottom: 8px; letter-spacing: 2px;">369WELLNESS</h1>
    <p style="color: #A3A3A3; font-size: 14px; margin-bottom: 24px;">Confirmação de Cadastro</p>
    <p style="font-size: 15px; color: #E5E5E5; line-height: 1.6; margin-bottom: 28px;">
      Olá! Seja bem-vindo à plataforma <strong>369WELLNESS</strong>. Para ativar sua conta e desbloquear seu acesso à plataforma, confirme seu e-mail clicando no botão abaixo:
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
        $app.save(usersCol)
      }

      // Disparar envio de teste com remetente primário e fallback se necessário
      let testEmailResult = { sent: false, error: null, sender_used: 'wellness369@outlook.com' }
      try {
        const testMessage = new MailerMessage({
          from: {
            address: 'wellness369@outlook.com',
            name: '369WELLNESS',
          },
          to: [{ address: 'ademariom07@gmail.com' }],
          subject: 'Teste de Conexão SMTP Brevo • 369WELLNESS',
          html: '<p>Teste de envio SMTP 369WELLNESS via smtp-relay.brevo.com:587 (wellness369@outlook.com).</p>',
        })
        $app.newMailClient().send(testMessage)
        testEmailResult.sent = true
      } catch (mailErr) {
        const errMsg = mailErr ? mailErr.message : 'Falha desconhecida no envio primário'
        testEmailResult.sent = false
        testEmailResult.error = errMsg
      }

      return c.json(200, {
        success: true,
        smtp_configured: true,
        sender: testEmailResult.sender_used,
        test_email: testEmailResult,
        diag: {
          raw_length: rawPass.length,
          trimmed_length: smtpPass.length,
          has_leading_space: hasLeading,
          has_trailing_space: hasTrailing,
          key_prefix: prefix,
        },
      })
    } catch (err) {
      return c.json(500, {
        success: false,
        error: err ? err.message : 'Erro ao processar teste SMTP',
      })
    }
  },
  $apis.requireAuth(),
)
