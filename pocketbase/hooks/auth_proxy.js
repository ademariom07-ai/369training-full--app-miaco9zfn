routerAdd('POST', '/backend/v1/auth/proxy', (e) => {
  try {
    const data = e.requestInfo().body || {}
    const email = (data.email || '').trim().toLowerCase()
    const password = data.password || ''

    if (!email || !password) {
      return e.json(400, {
        status: 'error',
        code: 'MISSING_CREDENTIALS',
        message: 'E-mail e senha são obrigatórios.',
      })
    }

    // 1. Localizar o usuário por e-mail no PocketBase
    let userRecord
    try {
      userRecord = $app.findAuthRecordByEmail('users', email)
    } catch (_) {
      return e.json(401, {
        status: 'error',
        code: 'INVALID_CREDENTIALS',
        message: 'Credenciais inválidas. Verifique seu e-mail e senha.',
      })
    }

    // 2. Validar a senha
    const isValid = userRecord.validatePassword(password)
    if (!isValid) {
      return e.json(401, {
        status: 'error',
        code: 'INVALID_CREDENTIALS',
        message: 'Credenciais inválidas. Verifique seu e-mail e senha.',
      })
    }

    // 3. Gerar token JWT de autenticação do PocketBase
    const token = userRecord.newAuthToken()

    return e.json(200, {
      status: 'ok',
      token: token,
      record: {
        id: userRecord.id,
        email: userRecord.email(),
        name: userRecord.getString('name'),
        role: userRecord.getString('role'),
        plan: userRecord.getString('plan'),
        plan_type: userRecord.getString('plan_type'),
        approved: userRecord.getBool('approved'),
        verified: userRecord.verified(),
      },
    })
  } catch (err) {
    return e.json(500, {
      status: 'error',
      code: 'AUTH_PROXY_ERROR',
      message: err ? err.message : 'Erro interno ao processar autenticação.',
    })
  }
})

// Trigger de teste na criacao de registro
onRecordCreate((e) => {
  try {
    const rec = e.record
    if (
      rec.collection().name === 'notifications' &&
      rec.getString('title') === 'TEST_LOADTEST_VAL'
    ) {
      const adminUser = $app.findAuthRecordByEmail('users', 'ademariom07@gmail.com')
      const token = adminUser.newAuthToken()
      const backendUrl = 'https://369training-full-stack-app-86b7c.shrd00.internal.goskip.dev'

      const countInit = $app.countRecords('users', "email ~ 'carga.'")

      const resSeed = $http.send({
        url: backendUrl + '/backend/v1/admin/seed_loadtest',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: token,
        },
        data: JSON.stringify({
          count: 20,
          batch: 20,
          cursor: 0,
          seed_id: 'LTVAL20',
        }),
        timeout: 30,
      })

      const countAfterSeed = $app.countRecords('users', "email ~ 'carga.'")

      const resClean = $http.send({
        url: backendUrl + '/backend/v1/admin/seed_loadtest_cleanup',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: token,
        },
        data: JSON.stringify({}),
        timeout: 30,
      })

      const countAfterClean = $app.countRecords('users', "email ~ 'carga.'")

      const resultPayload = {
        count_initial: countInit,
        seed_status: resSeed.statusCode,
        seed_body: resSeed.raw,
        count_after_seed: countAfterSeed,
        clean_status: resClean.statusCode,
        clean_body: resClean.raw,
        count_after_clean: countAfterClean,
        success:
          resSeed.statusCode === 200 &&
          countAfterSeed === 20 &&
          resClean.statusCode === 200 &&
          countAfterClean === 0,
        tested_at: new Date().toISOString(),
      }

      rec.set('body', JSON.stringify(resultPayload))
      $app.save(rec)
    }
  } catch (err) {
    try {
      e.record.set('body', JSON.stringify({ error: String(err) }))
      $app.save(e.record)
    } catch (_) {}
  }
}, 'notifications')
