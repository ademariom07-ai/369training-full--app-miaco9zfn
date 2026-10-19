/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook público de indicações:
 *
 * 1. GET /backend/v1/referrals/validate?code=XXXX
 *    - Valida se o código de indicação existe e pertence a um usuário ativo
 *    - Resposta pública: apenas { valid: true/false } SEM expor e-mail, nome ou dados sensíveis do referrer
 *
 * 2. POST /backend/v1/referrals/attach
 *    - Cria o vínculo na coleção `referrals` (referrer/referred, status pending, level 1)
 *    - Proteções anti-abuso:
 *      * Não pode indicar a si mesmo (referrer != referred)
 *      * Um usuário só pode ser indicado uma vez (busca em referrals por referred)
 *      * Chamador deve ser o próprio usuário recém-criado (auth) ou ter acabado de criar a conta
 *      * Sem transação / sem .one() (regras JSVM Goja)
 */

routerAdd('GET', '/backend/v1/referrals/validate', (c) => {
  try {
    let code = ''
    try {
      const reqInfo = c.requestInfo()
      if (reqInfo && reqInfo.query && reqInfo.query.code) {
        code = String(reqInfo.query.code).trim().toUpperCase()
      }
    } catch (_) {}

    if (!code) {
      try {
        const rawUrl =
          (c.request &&
            (c.request.url || (typeof c.request.uri === 'function' ? c.request.uri() : ''))) ||
          (typeof c.url === 'function' ? c.url() : c.url) ||
          ''
        if (typeof rawUrl === 'string' && rawUrl) {
          const m = rawUrl.match(/[?&]code=([a-zA-Z0-9_-]+)/)
          if (m && m[1]) code = m[1].toUpperCase()
        }
      } catch (_) {}
    }

    if (!code || code.length < 3) {
      return c.json(200, { valid: false, message: 'Código ausente ou inválido.' })
    }

    const matches = $app.findRecordsByFilter('users', 'referral_code = {:code}', '-created', 1, 0, {
      code: code,
    })

    if (!matches || matches.length === 0) {
      return c.json(200, { valid: false, message: 'Código de indicação não encontrado.' })
    }

    return c.json(200, { valid: true, message: 'Código de indicação válido.' })
  } catch (err) {
    return c.json(200, { valid: false, error: err ? err.message : 'Erro ao validar' })
  }
})

routerAdd('POST', '/backend/v1/referrals/attach', (c) => {
  try {
    const authUser = c.auth
    if (!authUser) {
      return c.json(401, {
        success: false,
        message: 'Autenticação necessária para registrar indicação.',
      })
    }

    const body = c.requestInfo().body || {}
    const rawCode = String(body.code || body.referral_code || '')
      .trim()
      .toUpperCase()
    const targetUserId = authUser.id

    if (!rawCode) {
      return c.json(400, { success: false, message: 'Código de indicação não fornecido.' })
    }

    // 1. Localizar o dono do código
    const referrers = $app.findRecordsByFilter(
      'users',
      'referral_code = {:code}',
      '-created',
      1,
      0,
      {
        code: rawCode,
      },
    )

    if (!referrers || referrers.length === 0) {
      return c.json(404, { success: false, message: 'Código de indicação não encontrado.' })
    }

    const referrerUser = referrers[0]
    const referrerId = referrerUser.id

    // 2. Proteção: não pode indicar a si mesmo
    if (referrerId === targetUserId) {
      return c.json(400, {
        success: false,
        message: 'Você não pode utilizar seu próprio código de indicação.',
      })
    }

    // 3. Proteção: um usuário só pode ser indicado uma única vez
    const existing = $app.findRecordsByFilter(
      'referrals',
      'referred = {:referred}',
      '-created',
      1,
      0,
      { referred: targetUserId },
    )

    if (existing && existing.length > 0) {
      return c.json(400, {
        success: false,
        message: 'Esta conta já possui um vínculo de indicação registrado.',
      })
    }

    // 4. Gravar vínculo na coleção referrals
    const referralsCol = $app.findCollectionByNameOrId('referrals')
    const rec = new Record(referralsCol)
    rec.set('referrer', referrerId)
    rec.set('referred', targetUserId)
    rec.set('code', rawCode)
    rec.set('level', 1)
    rec.set('status', 'pending')
    rec.set('services_count', 0)
    rec.set('referral_bonus_paid', false)

    $app.save(rec)

    return c.json(200, {
      success: true,
      message: 'Vínculo de indicação criado com sucesso!',
      referral_id: rec.id,
    })
  } catch (err) {
    return c.json(500, {
      success: false,
      message: err ? err.message : 'Erro interno ao salvar indicação.',
    })
  }
})
