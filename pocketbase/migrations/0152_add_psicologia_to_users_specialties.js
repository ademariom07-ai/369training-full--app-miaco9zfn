// 0152 — Adiciona "Psicologia" ao select `specialties` da coleção `users`.
//
// Causa raiz do erro de cadastro: o formulário (src/pages/Cadastro.tsx) oferece
// "Psicologia", mas o campo select `specialties` só aceita
// "Educação Física | Nutrição | Fisioterapia | Artes Marciais", e o POST
// /api/collections/users/records falha com 400 "Failed to create record".
//
// Idempotente: se o valor já existir no select, a migração é no-op.
// Na JSVM do PocketBase, Collection não tem .set() — usar atribuição direta.

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('users')

    const field = col.fields.getByName('specialties')
    if (!field) {
      throw new Error('0152: campo specialties não encontrado em users')
    }

    const current = field.values || []
    if (current.indexOf('Psicologia') !== -1) {
      console.log('0152: valor "Psicologia" já existe em users.specialties — no-op')
      return
    }

    const updated = current.slice()
    updated.push('Psicologia')
    field.values = updated
    app.save(col)
    console.log('0152: valor "Psicologia" adicionado a users.specialties')
  },
  (app) => {
    const col = app.findCollectionByNameOrId('users')
    const field = col.fields.getByName('specialties')
    if (!field) return
    const current = field.values || []
    if (current.indexOf('Psicologia') === -1) return
    field.values = current.filter(function (v) {
      return v !== 'Psicologia'
    })
    app.save(col)
  },
)
