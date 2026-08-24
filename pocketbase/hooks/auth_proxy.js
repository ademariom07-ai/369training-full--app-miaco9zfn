routerAdd('POST', '/api/hooks/auth-proxy', (e) => {
  try {
    const body = e.requestInfo().body || {}
    const identity = (body.identity || body.email || '').trim()
    const password = body.password || ''

    if (!identity || !password) {
      return e.json(400, {
        code: 400,
        message: 'Email/identidade e senha são obrigatórios',
      })
    }

    let record
    try {
      record = $app.dao().findAuthRecordByEmail('users', identity)
    } catch (_) {
      try {
        record = $app.dao().findFirstRecordByData('users', 'username', identity)
      } catch (err) {}
    }

    if (!record) {
      return e.json(401, {
        code: 401,
        message: 'Credenciais inválidas',
      })
    }

    const isValid = record.validatePassword(password)
    if (!isValid) {
      return e.json(401, {
        code: 401,
        message: 'Credenciais inválidas',
      })
    }

    const token = $tokens.recordAuthToken($app, record)

    return e.json(200, {
      token: token,
      record: record,
    })
  } catch (err) {
    return e.json(500, {
      code: 500,
      message: err.message || 'Erro interno no servidor',
    })
  }
})

routerAdd(
  'POST',
  '/api/hooks/auth-refresh',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) {
        return e.json(401, {
          code: 401,
          message: 'Token inválido ou não autenticado',
        })
      }

      let record
      try {
        record = $app.dao().findRecordById('users', userId)
      } catch (err) {
        return e.json(404, {
          code: 404,
          message: 'Usuário não encontrado',
        })
      }

      const token = $tokens.recordAuthToken($app, record)

      return e.json(200, {
        token: token,
        record: record,
      })
    } catch (err) {
      return e.json(500, {
        code: 500,
        message: err.message || 'Erro interno no servidor',
      })
    }
  },
  $apis.requireAuth(),
)
