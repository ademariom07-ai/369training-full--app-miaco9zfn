/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0135:
 * Criação da coleção `admin_invites` para o sistema de convites de uso único das 5 licenças administrativas.
 *
 * Campos:
 * - token: string única (hash aleatório)
 * - license_number: 1..5
 * - role_name: Nome do cargo (suporte, aprovações, financeiro, compliance, operações)
 * - email_licenca: e-mail institucional correspondente da licença (@369training.com)
 * - admin_user: relation -> users (conta da licença administrativa vinculada)
 * - personal_email: e-mail pessoal informado pelo convidado para recuperação
 * - personal_name: nome pessoal do convidado
 * - status: 'pendente' | 'aceito' | 'ativado' | 'expirado'
 * - expires_at: date (7 dias a partir da criação)
 * - accepted_at: date (data em que o convidado concluiu o primeiro acesso)
 * - activated_at: date (data em que o admin principal validou/ativou)
 * - created_by: relation -> users (Ademario / admin principal)
 *
 * Idempotente: se a coleção já existir, apenas verifica campos.
 */

migrate(
  (app) => {
    let invitesCol = null
    try {
      invitesCol = app.findCollectionByNameOrId('admin_invites')
    } catch (_) {
      invitesCol = null
    }

    if (!invitesCol) {
      const usersCol = app.findCollectionByNameOrId('users')
      const usersColId = usersCol ? usersCol.id : '_pb_users_auth_'

      invitesCol = new Collection({
        name: 'admin_invites',
        type: 'base',
        listRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        viewRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          { name: 'token', type: 'text', required: true },
          { name: 'license_number', type: 'number', required: true, onlyInt: true },
          { name: 'role_name', type: 'text', required: true },
          { name: 'email_licenca', type: 'text', required: true },
          {
            name: 'admin_user',
            type: 'relation',
            collectionId: usersColId,
            maxSelect: 1,
            cascadeDelete: false,
          },
          { name: 'personal_email', type: 'text' },
          { name: 'personal_name', type: 'text' },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['pendente', 'aceito', 'ativado', 'expirado'],
            maxSelect: 1,
          },
          { name: 'expires_at', type: 'date', required: true },
          { name: 'accepted_at', type: 'date' },
          { name: 'activated_at', type: 'date' },
          {
            name: 'created_by',
            type: 'relation',
            collectionId: usersColId,
            maxSelect: 1,
            cascadeDelete: false,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_admin_invites_token ON admin_invites (token)',
          'CREATE INDEX idx_admin_invites_status ON admin_invites (status)',
          'CREATE INDEX idx_admin_invites_license ON admin_invites (license_number)',
        ],
      })
      app.save(invitesCol)
      console.log('[0135_admin_invites] Coleção admin_invites criada com sucesso.')
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('admin_invites')
      if (col) app.delete(col)
    } catch (_) {}
  },
)
