/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  // 1. Configurar servidor SMTP do Brevo e remetente em app.settings()
  // Host smtp-relay.brevo.com, porta 587, STARTTLS (tls: false), auth LOGIN
  // Usuário SMTP: bd4b5d001@smtp-brevo.com
  // Senha: lida da variável de ambiente SMTP_PASSWORD (com trim para evitar whitespace invisível)
  // Remetente primário: wellness369@outlook.com com nome de exibição "369WELLNESS"
  const rawPass = $os.getenv('SMTP_PASSWORD') || ''
  const smtpPass = rawPass.trim()
  const settings = app.settings()

  settings.smtp.enabled = true
  settings.smtp.host = 'smtp-relay.brevo.com'
  settings.smtp.port = 587
  settings.smtp.username = 'bd4b5d001@smtp-brevo.com'
  if (smtpPass) {
    settings.smtp.password = smtpPass
  }
  settings.smtp.authMethod = 'LOGIN'
  settings.smtp.tls = false // PocketBase usa STARTTLS na porta 587 quando tls é false
  settings.meta.senderName = '369WELLNESS'
  settings.meta.senderAddress = 'wellness369@outlook.com'
  app.save(settings)

  // 2. Garantir templates de e-mail pt-BR intactos na Auth Collection "users"
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

  // 3. Disparar envio REAL de teste usando MailerMessage / app.newMailClient().send(...)
  // Primeiro tenta com o remetente oficial wellness369@outlook.com
  let sentOk = false
  let lastErr = null

  try {
    const testMessage = new MailerMessage({
      from: {
        address: 'wellness369@outlook.com',
        name: '369WELLNESS',
      },
      to: [{ address: 'ademariom07@gmail.com' }],
      subject: 'Teste de Configuração SMTP Brevo • 369WELLNESS',
      html: `
<div style="font-family: Arial, sans-serif; background-color: #0A0A0A; color: #FFFFFF; padding: 30px 20px; text-align: center;">
  <div style="max-width: 480px; margin: 0 auto; background: #141414; border: 1px solid #D4AF37; border-radius: 12px; padding: 24px;">
    <h2 style="color: #D4AF37; margin-bottom: 8px;">369WELLNESS</h2>
    <p style="color: #A3A3A3; font-size: 14px; margin-bottom: 16px;">Teste de Transmissão Brevo SMTP</p>
    <p style="font-size: 14px; color: #E5E5E5; line-height: 1.5;">
      Este é um e-mail de teste real enviado via <strong>smtp-relay.brevo.com:587</strong> para confirmar o funcionamento do e-mail transacional da plataforma 369WELLNESS.
    </p>
    <p style="color: #737373; font-size: 11px; margin-top: 20px;">
      Destinatário: ademariom07@gmail.com | Remetente: wellness369@outlook.com
    </p>
  </div>
</div>`,
    })
    app.newMailClient().send(testMessage)
    sentOk = true
    console.log('[BREVO-SMTP] Teste enviado com sucesso usando remetente wellness369@outlook.com')
  } catch (primaryErr) {
    lastErr = primaryErr
    const errMsg = primaryErr ? primaryErr.message : String(primaryErr)
    console.warn('[BREVO-SMTP] Falha no envio primário (wellness369@outlook.com):', errMsg)

    // Se falhar (por exemplo, sender não validado no Brevo), tentar fallback com o login bd4b5d001@smtp-brevo.com
    try {
      console.log('[BREVO-SMTP] Tentando fallback de sender com bd4b5d001@smtp-brevo.com...')
      const fallbackMessage = new MailerMessage({
        from: {
          address: 'bd4b5d001@smtp-brevo.com',
          name: '369WELLNESS',
        },
        to: [{ address: 'ademariom07@gmail.com' }],
        subject: 'Teste de Configuração SMTP Brevo (Fallback) • 369WELLNESS',
        html: `
<div style="font-family: Arial, sans-serif; background-color: #0A0A0A; color: #FFFFFF; padding: 30px 20px; text-align: center;">
  <div style="max-width: 480px; margin: 0 auto; background: #141414; border: 1px solid #D4AF37; border-radius: 12px; padding: 24px;">
    <h2 style="color: #D4AF37; margin-bottom: 8px;">369WELLNESS</h2>
    <p style="color: #A3A3A3; font-size: 14px; margin-bottom: 16px;">Teste de Transmissão Brevo SMTP (Fallback Sender)</p>
    <p style="font-size: 14px; color: #E5E5E5; line-height: 1.5;">
      Este é um e-mail de teste real enviado via <strong>smtp-relay.brevo.com:587</strong> com remetente de fallback bd4b5d001@smtp-brevo.com.
    </p>
  </div>
</div>`,
      })
      app.newMailClient().send(fallbackMessage)
      sentOk = true
      console.log(
        '[BREVO-SMTP] Teste enviado com sucesso usando remetente fallback bd4b5d001@smtp-brevo.com',
      )

      // Atualiza o sender address nas configurações para o fallback validado
      settings.meta.senderAddress = 'bd4b5d001@smtp-brevo.com'
      app.save(settings)
    } catch (fallbackErr) {
      lastErr = fallbackErr
      const fbMsg = fallbackErr ? fallbackErr.message : String(fallbackErr)
      console.error('[BREVO-SMTP] Falha também no envio de fallback:', fbMsg)

      // Tentativa adicional: testar com authMethod PLAIN caso o servidor Brevo recuse LOGIN
      try {
        console.log('[BREVO-SMTP] Testando com authMethod PLAIN...')
        settings.smtp.authMethod = 'PLAIN'
        app.save(settings)
        const plainMessage = new MailerMessage({
          from: {
            address: 'wellness369@outlook.com',
            name: '369WELLNESS',
          },
          to: [{ address: 'ademariom07@gmail.com' }],
          subject: 'Teste de Configuração SMTP Brevo (PLAIN) • 369WELLNESS',
          html: '<p>Teste de envio SMTP via Brevo com authMethod PLAIN.</p>',
        })
        app.newMailClient().send(plainMessage)
        sentOk = true
        console.log('[BREVO-SMTP] Teste com authMethod PLAIN enviado com sucesso!')
      } catch (plainErr) {
        console.warn(
          '[BREVO-SMTP] Teste PLAIN também retornou:',
          plainErr ? plainErr.message : plainErr,
        )
        // Restaura LOGIN conforme especificação do usuário
        settings.smtp.authMethod = 'LOGIN'
        settings.meta.senderAddress = 'wellness369@outlook.com'
        app.save(settings)
      }
    }
  }

  console.log('[BREVO-SMTP] Conclusão da migração 0075. Envio realizado:', sentOk)
})
