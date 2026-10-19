/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0134:
 * Reset seguro e definitivo das senhas temporárias das 5 licenças administrativas.
 *
 * Contas:
 * 1. admin.suporte@369training.com
 * 2. admin.aprovacoes@369training.com
 * 3. admin.financeiro@369training.com
 * 4. admin.compliance@369training.com
 * 5. admin.operacoes@369training.com
 *
 * Requisitos:
 * - Senhas temporárias fortes e aleatórias (>= 16 caracteres, maiúsculas, minúsculas, dígitos e símbolos).
 * - Sem tocar em papéis, permissões ou registros de usuários além da senha.
 * - Usar API nativa user.setPassword() + app.save(user) que trata o hash e tokenKey corretamente.
 * - Sem .one() e sem $app.runInTransaction para evitar pânicos Go na JSVM.
 */

migrate(
  (app) => {
    // Mapeamento com senhas temporárias seguras de alta entropia (geradas para esta rotação)
    const adminCredentials = [
      {
        email: 'admin.suporte@369training.com',
        tempPass: 'S3x#9kP!mQ8v$T2wR7yB',
      },
      {
        email: 'admin.aprovacoes@369training.com',
        tempPass: 'A9#vM4!zL8xQ2$tK7wPn',
      },
      {
        email: 'admin.financeiro@369training.com',
        tempPass: 'F5$yW2#bR8mX9!qT3vKp',
      },
      {
        email: 'admin.compliance@369training.com',
        tempPass: 'C8!mQ3$xP9vR4#tW2zLn',
      },
      {
        email: 'admin.operacoes@369training.com',
        tempPass: 'O2#tK9!wZ5vM7$rQ4xPb',
      },
    ]

    for (let i = 0; i < adminCredentials.length; i++) {
      const item = adminCredentials[i]
      try {
        const users = app.findRecordsByFilter('users', 'email = {:email}', '-created', 1, 0, {
          email: item.email,
        })

        if (!users || users.length === 0) {
          console.log('[0134_reset_admin_licenses] Conta não encontrada para e-mail:', item.email)
          continue
        }

        const user = users[0]
        user.setPassword(item.tempPass)
        app.save(user)
        console.log('[0134_reset_admin_licenses] Senha redefinida com sucesso para:', item.email)
      } catch (err) {
        console.log(
          '[0134_reset_admin_licenses] Erro ao redefinir senha para ' + item.email + ':',
          err ? err.message : '',
        )
      }
    }
  },
  (app) => {
    // Reversão não necessária para reset de senhas
  },
)
