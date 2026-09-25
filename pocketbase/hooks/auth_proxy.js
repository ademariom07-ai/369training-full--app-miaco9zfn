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
