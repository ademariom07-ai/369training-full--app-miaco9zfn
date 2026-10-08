/// <reference path="../pb_data/types.d.ts" />

// Configuration of Gmail SMTP & Custom Email Templates for 369WELLNESS
// Reads SMTP password from $os.getenv('SMTP_PASSWORD')

routerAdd(
  'POST',
  '/backend/v1/auth/test-smtp',
  (c) => {
    try {
      const authUser = c.auth
      if (!authUser || authUser.getString('role') !== 'admin') {
        return c.json(403, { success: false, message: 'Acesso restrito ao administrador.' })
      }

      const smtpPass = $os.getenv('SMTP_PASSWORD') || ''
      const settings = $app.settings()

      // Garantir configuração atualizada
      settings.smtp.enabled = true
      settings.smtp.host = 'smtp-mail.outlook.com'
      settings.smtp.port = 587
      settings.smtp.username = 'wellness369@outlook.com'
      if (smtpPass) {
        settings.smtp.password = smtpPass
      }
      settings.smtp.authMethod = 'LOGIN'
      settings.smtp.tls = false
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
        $app.save(usersCol)
      }

      // Disparar envio de teste
      let testEmailResult = { sent: false, error: null }
      try {
        const testMessage = new MailerMessage({
          from: {
            address: settings.meta.senderAddress,
            name: settings.meta.senderName,
          },
          to: [{ address: 'ademariom07@gmail.com' }],
          subject: 'Teste de Conexão SMTP Outlook • 369WELLNESS',
          html: '<p>Teste de envio SMTP 369WELLNESS via smtp-mail.outlook.com:587 (wellness369@outlook.com).</p>',
        })
        $app.newMailClient().send(testMessage)
        testEmailResult.sent = true
      } catch (mailErr) {
        testEmailResult.sent = false
        testEmailResult.error = mailErr ? mailErr.message : 'Falha desconhecida no envio de teste'
      }

      return c.json(200, {
        success: true,
        smtp_configured: true,
        sender: 'wellness369@outlook.com',
        test_email: testEmailResult,
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
