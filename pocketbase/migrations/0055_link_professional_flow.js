migrate(
  (app) => {
    // HOTFIX 369: Garantir índice de busca simples (não único) em users.linked_professional
    // para acelerar listagens de alunos vinculados por profissional.
    try {
      const usersCol = app.findCollectionByNameOrId('users')
      usersCol.addIndex('idx_users_linked_professional', false, 'linked_professional', '')
      app.save(usersCol)
    } catch (err) {
      console.log('Índice idx_users_linked_professional já existe ou não pôde ser adicionado:', err)
    }
  },
  (app) => {
    try {
      const usersCol = app.findCollectionByNameOrId('users')
      usersCol.removeIndex('idx_users_linked_professional')
      app.save(usersCol)
    } catch (_) {}
  },
)
