// Retired level-based closing. Approved replacement: global-linear-v1.
// Fail closed until server-side monthly snapshots, eligibility, ESG and ledger
// are implemented and validated. No reads, writes, resets or credits here.
// Source change only: effective protection requires deployment of these hooks.
routerAdd(
  'POST',
  '/backend/v1/admin/fechamento_mensal',
  (c) => {
    const authUser = c.auth
    if (!authUser) {
      return c.json(401, { status: 'error', code: 'UNAUTHORIZED', message: 'Autenticação necessária.' })
    }
    if (authUser.getString('role') !== 'admin') {
      return c.json(403, { status: 'error', code: 'FORBIDDEN', message: 'Acesso restrito a administradores.' })
    }
    return c.json(503, {
      status: 'error',
      code: 'LINEAR_CLOSING_NOT_READY',
      rules_version: 'global-linear-v1',
      retryable: false,
      message: 'Fechamento indisponível. O modelo por níveis foi encerrado; a distribuição linear aguarda integração e validação financeira no servidor.',
    })
  },
  $apis.requireAuth(),
)
