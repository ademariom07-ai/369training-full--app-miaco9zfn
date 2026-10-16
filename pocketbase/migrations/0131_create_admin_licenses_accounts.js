/// <reference path="../pb_data/types.d.ts" />

// Migração 0131:
// 1. Criar as 5 contas de admin (licenças) ativas e verificadas, autorizadas por Ademario
// 2. Vincular as contas à coleção admin_licenses já existente
// 3. Definir funções e permissões especializadas por papel
// 4. Limpar templates de e-mail sem expor token em texto puro

migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('users')
    let licensesCol = null
    try {
      licensesCol = app.findCollectionByNameOrId('admin_licenses')
    } catch (_) {}

    // Obter ID do admin titular (Ademario)
    let ademarioId = ''
    try {
      const ademario = app.findFirstRecordByFilter(
        'users',
        "email = 'ademariom07@gmail.com' || role = 'admin'",
      )
      if (ademario) ademarioId = ademario.id
    } catch (_) {}

    // Definição das 5 licenças solicitadas
    const licensesConfig = [
      {
        number: 1,
        name: 'Admin Suporte & Atendimento',
        email: 'admin.suporte@369training.com',
        roleDescription: 'Suporte, atendimento a alunos e parceiros, chat ao vivo',
        permissions: {
          usuarios: true,
          aprovacoes: false,
          ranking_cashback: false,
          auditoria: false,
          chat_suporte: true,
          documentos_legais: false,
        },
      },
      {
        number: 2,
        name: 'Admin Moderação & Aprovações',
        email: 'admin.aprovacoes@369training.com',
        roleDescription: 'Validação de credenciais de profissionais e moderação',
        permissions: {
          usuarios: true,
          aprovacoes: true,
          ranking_cashback: false,
          auditoria: true,
          chat_suporte: true,
          documentos_legais: false,
        },
      },
      {
        number: 3,
        name: 'Admin Financeiro & Cashback',
        email: 'admin.financeiro@369training.com',
        roleDescription: 'Gestão de ranking, cashback, ciclo e fechamento',
        permissions: {
          usuarios: true,
          aprovacoes: false,
          ranking_cashback: true,
          auditoria: true,
          chat_suporte: false,
          documentos_legais: false,
        },
      },
      {
        number: 4,
        name: 'Admin Auditoria & Compliance',
        email: 'admin.compliance@369training.com',
        roleDescription: 'Auditoria de segurança, documentos legais e compliance LGPD',
        permissions: {
          usuarios: true,
          aprovacoes: true,
          ranking_cashback: false,
          auditoria: true,
          chat_suporte: false,
          documentos_legais: true,
        },
      },
      {
        number: 5,
        name: 'Admin Operações & BackOffice',
        email: 'admin.operacoes@369training.com',
        roleDescription: 'Operações gerais, acompanhamento de parceiros e backoffice',
        permissions: {
          usuarios: true,
          aprovacoes: true,
          ranking_cashback: true,
          auditoria: false,
          chat_suporte: true,
          documentos_legais: false,
        },
      },
    ]

    const initialPassword = 'Admin369@Wellness!'

    licensesConfig.forEach((lic) => {
      let userRecord = null
      try {
        userRecord = app.findFirstRecordByFilter('users', `email = '${lic.email}'`)
      } catch (_) {
        userRecord = null
      }

      if (!userRecord) {
        userRecord = new Record(usersCol)
        userRecord.setEmail(lic.email)
        userRecord.setPassword(initialPassword)
        userRecord.set('name', lic.name)
        userRecord.set('role', 'admin')
        userRecord.set('plan', 'premium')
        userRecord.set('plan_type', 'profissional')
        userRecord.set('approved', true)
        userRecord.set('city', 'São Paulo')
        userRecord.set('state', 'SP')
        userRecord.set('country', 'Brasil')
        userRecord.set('subscription_status', 'ativa')
        userRecord.set('bio', lic.roleDescription)
        userRecord.set('referral_code', `ADM${lic.number}369`)
        userRecord.setVerified(true)
        app.save(userRecord)
      } else {
        // Garantir que esteja ativo e verificado
        userRecord.set('role', 'admin')
        userRecord.set('approved', true)
        userRecord.setVerified(true)
        userRecord.setPassword(initialPassword)
        app.save(userRecord)
      }

      // Atualizar ou criar o registro correspondente em admin_licenses
      if (licensesCol) {
        let licenseRec = null
        try {
          licenseRec = app.findFirstRecordByFilter(
            'admin_licenses',
            `license_number = ${lic.number}`,
          )
        } catch (_) {
          licenseRec = null
        }

        if (!licenseRec) {
          licenseRec = new Record(licensesCol)
          licenseRec.set('license_number', lic.number)
        }

        licenseRec.set('name', lic.name)
        licenseRec.set('email', lic.email)
        licenseRec.set('admin_user', userRecord.id)
        licenseRec.set('status', 'ativa')
        licenseRec.set('permissions', lic.permissions)
        licenseRec.set('notes', `Licença ativa criada para ${lic.name} (${lic.roleDescription})`)
        if (ademarioId) {
          licenseRec.set('created_by', ademarioId)
        }
        app.save(licenseRec)
      }
    })

    // -------------------------------------------------------------
    // Garantir templates de e-mail no usersCol (sem token exposto)
    // -------------------------------------------------------------
    usersCol.verificationTemplate = {
      subject: 'Verificação de E-mail • 369WELLNESS',
      body: `<div style="display:none;font-size:1px;color:#0A0A0A;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">Confirmação de cadastro na plataforma 369WELLNESS. Clique para ativar sua conta.</div>
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
      body: `<div style="display:none;font-size:1px;color:#0A0A0A;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">Redefinição de senha da sua conta 369WELLNESS. Clique no botão abaixo para definir sua nova credencial.</div>
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
      body: `<div style="display:none;font-size:1px;color:#0A0A0A;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">Confirmação de alteração de e-mail na sua conta 369WELLNESS.</div>
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
  },
  (app) => {
    // Reversão
    try {
      const emails = [
        'admin.suporte@369training.com',
        'admin.aprovacoes@369training.com',
        'admin.financeiro@369training.com',
        'admin.compliance@369training.com',
        'admin.operacoes@369training.com',
      ]
      emails.forEach((email) => {
        try {
          const u = app.findFirstRecordByFilter('users', `email = '${email}'`)
          if (u) app.delete(u)
        } catch (_) {}
      })
    } catch (_) {}
  },
)
