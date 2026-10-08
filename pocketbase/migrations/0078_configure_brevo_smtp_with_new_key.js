/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  // 1. Configurar servidor SMTP do Brevo conforme especificações oficiais
  // Host: smtp-relay.brevo.com, porta: 587, authMethod: LOGIN, tls: false (STARTTLS)
  // Username: bd4b5d001@smtp-brevo.com
  // Password: lida exclusivamente do segredo de ambiente SMTP_PASSWORD
  // Remetente: wellness369@outlook.com com nome de exibição "369WELLNESS"
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

  // 3. Disparo REAL de teste de envio para ademariom07@gmail.com
  try {
    const testMessage = new MailerMessage({
      from: {
        address: 'wellness369@outlook.com',
        name: '369WELLNESS',
      },
      to: [{ address: 'ademariom07@gmail.com' }],
      subject: 'Teste de Ativação Brevo SMTP • 369WELLNESS',
      html: `
<div style="font-family: Arial, sans-serif; background-color: #0A0A0A; color: #FFFFFF; padding: 32px 20px; text-align: center;">
  <div style="max-width: 500px; margin: 0 auto; background: #141414; border: 1px solid #D4AF37; border-radius: 16px; padding: 32px;">
    <h2 style="color: #D4AF37; font-size: 22px; margin-bottom: 8px; letter-spacing: 1px;">369WELLNESS</h2>
    <p style="color: #A3A3A3; font-size: 13px; margin-bottom: 20px;">Teste Oficial de Conexão SMTP Brevo</p>
    <p style="font-size: 15px; color: #E5E5E5; line-height: 1.6;">
      Este e-mail confirma que a conexão entre o backend <strong>369WELLNESS</strong> e o relay SMTP do <strong>Brevo (smtp-relay.brevo.com:587)</strong> está operando com a nova credencial segura.
    </p>
    <div style="margin-top: 24px; padding: 16px; background: #1F1F1F; border-radius: 8px; text-align: left; font-size: 13px; color: #CCCCCC;">
      <div>• <strong>Host:</strong> smtp-relay.brevo.com:587 (STARTTLS)</div>
      <div>• <strong>Auth:</strong> LOGIN</div>
      <div>• <strong>Login:</strong> bd4b5d001@smtp-brevo.com</div>
      <div>• <strong>Remetente:</strong> wellness369@outlook.com</div>
      <div>• <strong>Destinatário:</strong> ademariom07@gmail.com</div>
    </div>
    <p style="color: #737373; font-size: 11px; margin-top: 24px;">
      369WELLNESS LTDA • Automação de E-mail Transacional
    </p>
  </div>
</div>`,
    })

    app.newMailClient().send(testMessage)
    console.log('[BREVO-SMTP-0078] E-mail de teste enviado com sucesso via Brevo!')
  } catch (err) {
    const errorStr = err ? err.message || String(err) : 'Erro desconhecido'
    console.error('[BREVO-SMTP-0078] Falha no envio do e-mail de teste:', errorStr)
  }
})
