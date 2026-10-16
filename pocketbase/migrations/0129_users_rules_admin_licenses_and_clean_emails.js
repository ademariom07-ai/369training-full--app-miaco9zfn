/// <reference path="../pb_data/types.d.ts" />

// Migração 0129:
// 1. Atualizar API rules de users para permitir que Alunos e Profissionais listem e conversem com o Admin (Suporte)
// 2. Criar coleção admin_licenses para as 5 licenças adicionais gerenciadas por Ademario
// 3. Atualizar templates de e-mail (resetPassword, verification, confirmEmailChange) sem token cru e com preheader invisível

migrate(
  (app) => {
    // -------------------------------------------------------------
    // 1. Atualizar API rules da coleção "users"
    // -------------------------------------------------------------
    const users = app.findCollectionByNameOrId('users')

    // Aluno vê a si mesmo, profissionais e admins (para canal de Suporte).
    // Profissional vê a si mesmo, alunos vinculados e admins (para canal de Suporte).
    // Admin vê todos.
    const adminOrSelf = "id = @request.auth.id || @request.auth.role = 'admin'"
    const alunoRule = "@request.auth.role = 'aluno' && (role = 'profissional' || role = 'admin')"
    const proRule =
      "@request.auth.role = 'profissional' && ((role = 'aluno' && linked_professional = @request.auth.id) || role = 'admin')"
    const newUsersRule = `${adminOrSelf} || (${alunoRule}) || (${proRule})`

    users.listRule = newUsersRule
    users.viewRule = newUsersRule

    // Permitir que o Admin titular atualize usuários (como criar/editar sub-admins ou alterar permissões)
    users.updateRule =
      "@request.auth.role = 'admin' || (id = @request.auth.id && @request.body.plan:isset = false && @request.body.plan_type:isset = false && @request.body.plan_upgraded_at:isset = false && @request.body.role:isset = false && @request.body.approved:isset = false && @request.body.tree_position:isset = false && @request.body.tree_level:isset = false && @request.body.verified:isset = false && @request.body.rating_avg:isset = false && @request.body.subscription_status:isset = false && @request.body.subscription_expires_at:isset = false && @request.body.linked_professional:isset = false && @request.body.linked_prof_fee_mode:isset = false && (@request.body.cpf:isset = false || cpf = ''))"

    // -------------------------------------------------------------
    // 2. Templates de e-mail limpos (sem token cru, apenas botão clicável)
    // -------------------------------------------------------------
    users.verificationTemplate = {
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

    users.resetPasswordTemplate = {
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

    users.confirmEmailChangeTemplate = {
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

    app.save(users)

    // -------------------------------------------------------------
    // 3. Criar coleção "admin_licenses" para gestão das 5 licenças
    // -------------------------------------------------------------
    let licensesCol
    try {
      licensesCol = app.findCollectionByNameOrId('admin_licenses')
    } catch (_) {
      licensesCol = null
    }

    if (!licensesCol) {
      licensesCol = new Collection({
        name: 'admin_licenses',
        type: 'base',
        listRule: "@request.auth.role = 'admin'",
        viewRule: "@request.auth.role = 'admin'",
        createRule: "@request.auth.role = 'admin'",
        updateRule: "@request.auth.role = 'admin'",
        deleteRule: "@request.auth.role = 'admin'",
        fields: [
          { name: 'license_number', type: 'number', required: true, min: 1, max: 5 },
          { name: 'name', type: 'text' },
          { name: 'email', type: 'email' },
          {
            name: 'admin_user',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['disponivel', 'ativa', 'inativa'],
            maxSelect: 1,
          },
          { name: 'permissions', type: 'json' },
          {
            name: 'created_by',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'notes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_admin_licenses_number ON admin_licenses (license_number)',
        ],
      })
      app.save(licensesCol)
    }

    // Seed das 5 licenças se ainda não existirem
    const defaultPermissions = {
      usuarios: true,
      aprovacoes: true,
      ranking_cashback: false,
      auditoria: false,
      chat_suporte: true,
      documentos_legais: false,
    }

    let ademarioId = ''
    try {
      const ademario = app.findFirstRecordByFilter(
        'users',
        "email = 'ademariom07@gmail.com' || role = 'admin'",
      )
      if (ademario) ademarioId = ademario.id
    } catch (_) {}

    for (let i = 1; i <= 5; i++) {
      try {
        app.findFirstRecordByFilter('admin_licenses', `license_number = ${i}`)
      } catch (_) {
        const record = new Record(licensesCol)
        record.set('license_number', i)
        record.set('name', `Licença Sub-Admin #${i}`)
        record.set('status', 'disponivel')
        record.set('permissions', defaultPermissions)
        if (ademarioId) {
          record.set('created_by', ademarioId)
        }
        record.set('notes', `Licença adicional ${i} de 5 autorizadas pelo admin titular Ademario`)
        app.save(record)
      }
    }
  },
  (app) => {
    // Reverter regras de users e deletar admin_licenses se aplicável
    try {
      const users = app.findCollectionByNameOrId('users')
      const proRule =
        "@request.auth.role = 'profissional' && role = 'aluno' && linked_professional = @request.auth.id"
      const alunoRule = "@request.auth.role = 'aluno' && role = 'profissional'"
      const adminOrSelf = "id = @request.auth.id || @request.auth.role = 'admin'"
      const revertRule = `${adminOrSelf} || (${alunoRule}) || (${proRule})`
      users.listRule = revertRule
      users.viewRule = revertRule
      app.save(users)
    } catch (_) {}

    try {
      const col = app.findCollectionByNameOrId('admin_licenses')
      if (col) app.delete(col)
    } catch (_) {}
  },
)
