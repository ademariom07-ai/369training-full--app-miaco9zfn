/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook do Sistema de Convites das 5 Licenças Administrativas
 *
 * 1. POST /backend/v1/admin/invites/generate
 *    - Restrito a admin (Ademario / admin principal)
 *    - Gera ou renova os 5 links de convite (1 por cargo) com expiração de 7 dias e tokens únicos
 *
 * 2. GET /backend/v1/admin/invites/list
 *    - Restrito a admin
 *    - Lista todos os convites com status, datas, nome e e-mail pessoal informado
 *
 * 3. GET /backend/v1/public/invite/check?token=XXX
 *    - Endpoint público para a página de Primeiro Acesso
 *    - Retorna cargo, status, se expirou, email_licenca
 *
 * 4. POST /backend/v1/public/invite/accept
 *    - Endpoint público
 *    - Convidado envia: token, temp_password, new_password, personal_name, personal_email
 *    - Valida credencial atual da licença com temp_password
 *    - Define nova senha pessoal
 *    - Grava e-mail pessoal e nome no convite e atualiza status para 'aceito'
 *    - Coloca a conta em approved = false (pendente de ativação pelo admin principal)
 *    - Altera o status da licença em admin_licenses para 'inativa' (ou aguardando)
 *
 * 5. POST /backend/v1/admin/invites/activate
 *    - Restrito a admin principal
 *    - Admin ativa o convite aceito -> status vira 'ativado' -> user.approved = true
 */

// 1. Gerar os 5 convites
routerAdd(
  'POST',
  '/backend/v1/admin/invites/generate',
  (c) => {
    try {
      const authUser = c.auth
      if (!authUser) {
        return c.json(401, { success: false, message: 'Autenticação necessária.' })
      }
      if (authUser.getString('role') !== 'admin') {
        return c.json(403, { success: false, message: 'Acesso restrito a administradores.' })
      }

      const licensesRolesList = [
        {
          number: 1,
          role_name: 'Suporte & Atendimento',
          email: 'admin.suporte@369training.com',
        },
        {
          number: 2,
          role_name: 'Moderação & Aprovações',
          email: 'admin.aprovacoes@369training.com',
        },
        {
          number: 3,
          role_name: 'Financeiro & Cashback',
          email: 'admin.financeiro@369training.com',
        },
        {
          number: 4,
          role_name: 'Auditoria & Compliance',
          email: 'admin.compliance@369training.com',
        },
        {
          number: 5,
          role_name: 'Operações & BackOffice',
          email: 'admin.operacoes@369training.com',
        },
      ]

      const invitesCol = $app.findCollectionByNameOrId('admin_invites')
      const now = new Date()
      // Expiração de 7 dias
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      const expiresAtIso = expiresAt.toISOString().replace('T', ' ').slice(0, 19)

      const generatedList = []

      for (let i = 0; i < licensesRolesList.length; i++) {
        const item = licensesRolesList[i]

        // Buscar conta correspondente em users
        let userRec = null
        try {
          const uMatches = $app.findRecordsByFilter('users', 'email = {:email}', '-created', 1, 0, {
            email: item.email,
          })
          if (uMatches && uMatches.length > 0) {
            userRec = uMatches[0]
          }
        } catch (_) {}

        // Gerar token seguro de 32 chars
        const token =
          'inv_' +
          $security.randomString(24).toLowerCase() +
          '_' +
          Date.now().toString(36).slice(-4)

        // Verificar se já existe convite pendente para esta licença; se existir, expirar ou atualizar
        const existing = $app.findRecordsByFilter(
          'admin_invites',
          'license_number = {:lic} && (status = "pendente" || status = "expirado")',
          '-created',
          1,
          0,
          { lic: item.number },
        )

        let record
        if (existing && existing.length > 0) {
          record = existing[0]
        } else {
          record = new Record(invitesCol)
          record.set('license_number', item.number)
          record.set('created_by', authUser.id)
        }

        record.set('token', token)
        record.set('role_name', item.role_name)
        record.set('email_licenca', item.email)
        if (userRec) {
          record.set('admin_user', userRec.id)
        }
        record.set('status', 'pendente')
        record.set('expires_at', expiresAtIso)
        record.set('accepted_at', '')
        record.set('activated_at', '')

        $app.save(record)

        generatedList.push({
          id: record.id,
          license_number: item.number,
          role_name: item.role_name,
          email_licenca: item.email,
          token: token,
          status: 'pendente',
          expires_at: expiresAtIso,
        })
      }

      return c.json(200, {
        success: true,
        message: '5 links de convite gerados com sucesso!',
        invites: generatedList,
      })
    } catch (err) {
      return c.json(500, {
        success: false,
        message: err ? err.message : 'Erro ao gerar convites.',
      })
    }
  },
  $apis.requireAuth(),
)

// 2. Listar todos os convites
routerAdd(
  'GET',
  '/backend/v1/admin/invites/list',
  (c) => {
    try {
      const authUser = c.auth
      if (!authUser || authUser.getString('role') !== 'admin') {
        return c.json(403, { success: false, message: 'Acesso restrito.' })
      }

      // Marcar como expirados os que passaram de expires_at e ainda estão pendentes
      const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19)
      const allInvites = $app.findRecordsByFilter(
        'admin_invites',
        'id != ""',
        'license_number',
        50,
        0,
      )

      const result = []
      for (let i = 0; i < allInvites.length; i++) {
        const inv = allInvites[i]
        let st = inv.getString('status')
        const exp = inv.getString('expires_at')
        if (st === 'pendente' && exp && exp < nowIso) {
          st = 'expirado'
          inv.set('status', 'expirado')
          try {
            $app.save(inv)
          } catch (_) {}
        }

        result.push({
          id: inv.id,
          token: inv.getString('token'),
          license_number: inv.getInt('license_number'),
          role_name: inv.getString('role_name'),
          email_licenca: inv.getString('email_licenca'),
          admin_user: inv.getString('admin_user'),
          personal_email: inv.getString('personal_email'),
          personal_name: inv.getString('personal_name'),
          status: st,
          expires_at: inv.getString('expires_at'),
          accepted_at: inv.getString('accepted_at'),
          activated_at: inv.getString('activated_at'),
          created: inv.getString('created'),
        })
      }

      return c.json(200, {
        success: true,
        invites: result,
      })
    } catch (err) {
      return c.json(500, {
        success: false,
        message: err ? err.message : 'Erro ao listar convites.',
      })
    }
  },
  $apis.requireAuth(),
)

// 3. Checar token do convite (público)
routerAdd('GET', '/backend/v1/public/invite/check', (c) => {
  try {
    let token = ''
    try {
      const reqInfo = c.requestInfo()
      if (reqInfo && reqInfo.query && reqInfo.query.token) {
        token = String(reqInfo.query.token).trim()
      }
    } catch (_) {}

    if (!token) {
      try {
        const rawUrl =
          (c.request &&
            (c.request.url || (typeof c.request.uri === 'function' ? c.request.uri() : ''))) ||
          ''
        const m = rawUrl.match(/[?&]token=([a-zA-Z0-9_-]+)/)
        if (m && m[1]) token = m[1]
      } catch (_) {}
    }

    if (!token) {
      return c.json(400, { valid: false, message: 'Token não fornecido.' })
    }

    const matches = $app.findRecordsByFilter(
      'admin_invites',
      'token = {:token}',
      '-created',
      1,
      0,
      {
        token: token,
      },
    )

    if (!matches || matches.length === 0) {
      return c.json(404, { valid: false, message: 'Convite não encontrado ou link inválido.' })
    }

    const inv = matches[0]
    let st = inv.getString('status')
    const exp = inv.getString('expires_at')
    const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19)

    if (st === 'pendente' && exp && exp < nowIso) {
      st = 'expirado'
      inv.set('status', 'expirado')
      try {
        $app.save(inv)
      } catch (_) {}
    }

    return c.json(200, {
      valid: st === 'pendente',
      status: st,
      role_name: inv.getString('role_name'),
      license_number: inv.getInt('license_number'),
      email_licenca: inv.getString('email_licenca'),
      expires_at: exp,
      accepted_at: inv.getString('accepted_at'),
      personal_name: inv.getString('personal_name'),
    })
  } catch (err) {
    return c.json(500, { valid: false, error: err ? err.message : 'Erro interno.' })
  }
})

// 4. Aceitar convite: primeiro acesso com troca de senha e cadastro de e-mail pessoal
routerAdd('POST', '/backend/v1/public/invite/accept', (c) => {
  try {
    const body = c.requestInfo().body || {}
    const token = String(body.token || '').trim()
    const tempPassword = String(body.temp_password || '').trim()
    const newPassword = String(body.new_password || '').trim()
    const personalEmail = String(body.personal_email || '')
      .trim()
      .toLowerCase()
    const personalName = String(body.personal_name || '').trim()

    if (!token) {
      return c.json(400, { success: false, message: 'Token de convite obrigatório.' })
    }
    if (!tempPassword) {
      return c.json(400, { success: false, message: 'Senha temporária da licença é obrigatória.' })
    }
    if (!newPassword || newPassword.length < 8) {
      return c.json(400, {
        success: false,
        message: 'A nova senha deve possuir no mínimo 8 caracteres.',
      })
    }
    if (!personalEmail || !personalEmail.includes('@') || !personalEmail.includes('.')) {
      return c.json(400, {
        success: false,
        message: 'E-mail pessoal válido é obrigatório para recuperação.',
      })
    }
    if (!personalName) {
      return c.json(400, { success: false, message: 'Informe seu nome completo.' })
    }

    // 1. Validar convite
    const matches = $app.findRecordsByFilter(
      'admin_invites',
      'token = {:token}',
      '-created',
      1,
      0,
      {
        token: token,
      },
    )

    if (!matches || matches.length === 0) {
      return c.json(404, { success: false, message: 'Convite não encontrado.' })
    }

    const inviteRec = matches[0]
    const currentStatus = inviteRec.getString('status')
    const exp = inviteRec.getString('expires_at')
    const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19)

    if (currentStatus === 'expirado' || (exp && exp < nowIso)) {
      inviteRec.set('status', 'expirado')
      $app.save(inviteRec)
      return c.json(400, {
        success: false,
        message:
          'Este convite expirou (validade de 7 dias ultrapassada). Solicite novo link ao admin principal.',
      })
    }

    if (currentStatus !== 'pendente') {
      return c.json(400, {
        success: false,
        message: 'Este convite já foi utilizado (status: ' + currentStatus + ').',
      })
    }

    // 2. Buscar o usuário da licença
    const emailLicenca = inviteRec.getString('email_licenca')
    const userMatches = $app.findRecordsByFilter('users', 'email = {:email}', '-created', 1, 0, {
      email: emailLicenca,
    })

    if (!userMatches || userMatches.length === 0) {
      return c.json(404, {
        success: false,
        message: 'Conta administrativa da licença não encontrada.',
      })
    }

    const adminUser = userMatches[0]

    // 3. Validar a senha temporária usando validatePassword do Record do PocketBase
    const passValid = adminUser.validatePassword(tempPassword)
    if (!passValid) {
      return c.json(400, {
        success: false,
        message: 'A senha temporária informada está incorreta para esta licença.',
      })
    }

    // 4. Trocar a senha do usuário e definir status pendente de ativação
    adminUser.setPassword(newPassword)
    // Manter approved = false até que o admin principal ative o convite
    adminUser.set('approved', false)
    adminUser.set('name', personalName + ' (' + inviteRec.getString('role_name') + ')')
    // Guardar e-mail pessoal nas anotações/bio para recuperação
    const currentBio = adminUser.getString('bio') || ''
    adminUser.set('bio', 'E-mail pessoal para recuperação: ' + personalEmail + ' | ' + currentBio)
    $app.save(adminUser)

    // 5. Atualizar convite para status 'aceito' (pendente de ativação)
    inviteRec.set('status', 'aceito')
    inviteRec.set('personal_email', personalEmail)
    inviteRec.set('personal_name', personalName)
    inviteRec.set('accepted_at', nowIso)
    $app.save(inviteRec)

    // 6. Atualizar a coleção admin_licenses se houver registro vinculado
    try {
      const licNum = inviteRec.getInt('license_number')
      const licMatches = $app.findRecordsByFilter(
        'admin_licenses',
        'license_number = {:num}',
        '-created',
        1,
        0,
        { num: licNum },
      )
      if (licMatches && licMatches.length > 0) {
        const licRec = licMatches[0]
        licRec.set('status', 'inativa') // Fica inativa até aprovação final
        licRec.set(
          'notes',
          'Primeiro acesso realizado por ' +
            personalName +
            ' (' +
            personalEmail +
            ') em ' +
            nowIso +
            ' - aguardando validação do admin principal.',
        )
        $app.save(licRec)
      }
    } catch (_) {}

    return c.json(200, {
      success: true,
      message:
        'Primeiro acesso concluído! Sua senha foi alterada com sucesso e seu e-mail pessoal foi vinculado. Sua licença agora aguarda a validação/ativação final pelo administrador principal.',
    })
  } catch (err) {
    return c.json(500, {
      success: false,
      message: err ? err.message : 'Erro ao processar primeiro acesso.',
    })
  }
})

// 5. Ativar convite aceito (Ademario / admin principal)
routerAdd(
  'POST',
  '/backend/v1/admin/invites/activate',
  (c) => {
    try {
      const authUser = c.auth
      if (!authUser || authUser.getString('role') !== 'admin') {
        return c.json(403, { success: false, message: 'Acesso restrito.' })
      }

      const body = c.requestInfo().body || {}
      const inviteId = String(body.invite_id || body.id || '').trim()

      if (!inviteId) {
        return c.json(400, { success: false, message: 'ID do convite não fornecido.' })
      }

      const inviteRec = $app.findRecordById('admin_invites', inviteId)
      if (!inviteRec) {
        return c.json(404, { success: false, message: 'Convite não encontrado.' })
      }

      const currentStatus = inviteRec.getString('status')
      if (currentStatus !== 'aceito') {
        return c.json(400, {
          success: false,
          message:
            'Apenas convites com status "aceito" podem ser ativados (status atual: ' +
            currentStatus +
            ').',
        })
      }

      const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19)

      // 1. Atualizar convite para 'ativado'
      inviteRec.set('status', 'ativado')
      inviteRec.set('activated_at', nowIso)
      $app.save(inviteRec)

      // 2. Liberar login da conta de admin correspondente (approved = true)
      const adminUserId = inviteRec.getString('admin_user')
      let adminUserRec = null
      if (adminUserId) {
        try {
          adminUserRec = $app.findRecordById('users', adminUserId)
        } catch (_) {}
      }
      if (!adminUserRec) {
        const emailLic = inviteRec.getString('email_licenca')
        const matches = $app.findRecordsByFilter('users', 'email = {:email}', '-created', 1, 0, {
          email: emailLic,
        })
        if (matches && matches.length > 0) adminUserRec = matches[0]
      }

      if (adminUserRec) {
        adminUserRec.set('approved', true)
        $app.save(adminUserRec)
      }

      // 3. Atualizar admin_licenses para status 'ativa'
      try {
        const licNum = inviteRec.getInt('license_number')
        const licMatches = $app.findRecordsByFilter(
          'admin_licenses',
          'license_number = {:num}',
          '-created',
          1,
          0,
          { num: licNum },
        )
        if (licMatches && licMatches.length > 0) {
          const licRec = licMatches[0]
          licRec.set('status', 'ativa')
          licRec.set(
            'notes',
            'Licença ativada por ' +
              authUser.getString('name') +
              ' para ' +
              inviteRec.getString('personal_name') +
              ' em ' +
              nowIso,
          )
          $app.save(licRec)
        }
      } catch (_) {}

      return c.json(200, {
        success: true,
        message: 'Licença administrativa ativada com sucesso!',
      })
    } catch (err) {
      return c.json(500, {
        success: false,
        message: err ? err.message : 'Erro ao ativar convite.',
      })
    }
  },
  $apis.requireAuth(),
)
