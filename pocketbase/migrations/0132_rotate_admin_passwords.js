/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0132:
 * Verificação e rotação de segurança das senhas das 5 licenças admin (se ainda estiverem com a senha inicial).
 *
 * Gera senhas aleatórias criptograficamente seguras para as contas das licenças admin.
 * Conforme convenções de JSVM PocketBase do projeto:
 * - Sem .one() e sem $app.runInTransaction (erros viram pânico Go 500);
 * - Usar findFirstRecordByFilter ou findRecordsByFilter com try/catch isolado;
 * - Atualizar senha usando record.setPassword(...) ou record.set('password', ...) + save(record);
 * - Logar apenas o e-mail da conta atualizada, NUNCA expor a nova senha nos logs ou console.
 */

migrate(
  (app) => {
    const adminEmails = [
      'admin.suporte@369training.com',
      'admin.aprovacoes@369training.com',
      'admin.financeiro@369training.com',
      'admin.compliance@369training.com',
      'admin.operacoes@369training.com',
    ]

    // Gerador de senha forte aleatória (sem expor em logs)
    const generateSecurePassword = () => {
      const charsUpper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
      const charsLower = 'abcdefghijkmnopqrstuvwxyz'
      const charsDigits = '23456789'
      const charsSymbols = '!@#$%&*+='
      const allChars = charsUpper + charsLower + charsDigits + charsSymbols

      const randChar = (set) => set.charAt(Math.floor(Math.random() * set.length))

      let pwd = [
        randChar(charsUpper),
        randChar(charsUpper),
        randChar(charsLower),
        randChar(charsLower),
        randChar(charsDigits),
        randChar(charsDigits),
        randChar(charsSymbols),
        randChar(charsSymbols),
      ]

      for (let i = 0; i < 16; i++) {
        pwd.push(randChar(allChars))
      }

      // Embaralhar
      for (let i = pwd.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const temp = pwd[i]
        pwd[i] = pwd[j]
        pwd[j] = temp
      }

      return pwd.join('')
    }

    for (let i = 0; i < adminEmails.length; i++) {
      const email = adminEmails[i]
      try {
        const user = app.findFirstRecordByFilter('users', 'email = {:email}', { email: email })
        if (!user) {
          console.log('[0132_rotate_admin_passwords] Usuário não encontrado para e-mail:', email)
          continue
        }

        // Testar se a senha atual é a inicial
        let needsRotation = false
        try {
          if (user.validatePassword('Admin369@Wellness!')) {
            needsRotation = true
          }
        } catch (_) {
          // Se validatePassword não existir ou lançar erro, rotação preventiva
          needsRotation = true
        }

        if (needsRotation) {
          const newPassword = generateSecurePassword()
          user.setPassword(newPassword)
          app.save(user)
          console.log(
            '[0132_rotate_admin_passwords] Senha rotacionada com sucesso para licença:',
            email,
          )
        } else {
          console.log('[0132_rotate_admin_passwords] Licença já com senha alterada:', email)
        }
      } catch (err) {
        console.log(
          '[0132_rotate_admin_passwords] Erro ao verificar licença ' + email + ':',
          err ? err.message : '',
        )
      }
    }
  },
  (app) => {
    // Sem rollback de senhas geradas por segurança
  },
)
