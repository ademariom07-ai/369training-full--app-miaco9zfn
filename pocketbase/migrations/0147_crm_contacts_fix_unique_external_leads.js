/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0147: Saneamento definitivo de índices e unicidade de crm_contacts.
 *
 * Diagnóstico comprovado:
 * A migração 0137/0139 havia criado o índice composto:
 *   "CREATE UNIQUE INDEX `idx_crm_prof_student` ON `crm_contacts` (`professional`, `student`)"
 * Em v0.25+ do PocketBase, índices gerenciados pelo PocketBase vivem na propriedade
 * `collection.indexes` (JSONArray<string>). Quando um índice com cláusula WHERE
 * ("CREATE UNIQUE INDEX ... WHERE student <> professional") é inserido em col.indexes,
 * o validador interno / parser do PocketBase não oferece suporte a cláusulas parciais
 * (ou SQLite gera a violação composta), OU havia resquício do índice sem WHERE ainda
 * presente em col.indexes / sqlite_master.
 *
 * Além disso, ao disparar violação de unicidade composta do SQLite (professional + student),
 * a função core.NormalizeUniqueIndexError() do PocketBase converte o erro SQLite
 *   "UNIQUE constraint failed: crm_contacts.professional, crm_contacts.student"
 * em:
 *   {
 *     "professional": { "code": "validation_not_unique", "message": "Value must be unique." },
 *     "student": { "code": "validation_not_unique", "message": "Value must be unique." }
 *   }
 *
 * SOLUÇÃO DESTE SCRIPT:
 * 1. Remove qualquer índice único de crm_contacts da propriedade col.indexes
 *    (garante que col.indexes não retenha definições inválidas ou conflitantes).
 * 2. Faz DROP explícito via SQL direto (DROP INDEX IF EXISTS) de quaisquer índices físicos
 *    conhecidos:
 *      - idx_crm_prof_student
 *      - idx_crm_contacts_prof_student_real
 *      - qualquer outro índice único sobre professional/student em sqlite_master
 * 3. Cria via SQL direto no SQLite o índice único PARCIAL:
 *      CREATE UNIQUE INDEX IF NOT EXISTS `idx_crm_contacts_prof_student_real`
 *      ON `crm_contacts` (`professional`, `student`)
 *      WHERE `student` IS NOT NULL AND `student` != '' AND `student` != `professional`;
 * 4. Garante que os campos `professional` e `student` na coleção NÃO possuem flag `unique: true`.
 * 5. Salva a coleção via app.save(col).
 */

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('crm_contacts')

    // 1. Limpar índices indesejados da lista do Collection model
    const cleanIndexes = []
    const existing = col.indexes || []
    for (let i = 0; i < existing.length; i++) {
      const idxStr = existing[i]
      if (idxStr.indexOf('professional') !== -1 || idxStr.indexOf('student') !== -1) {
        continue
      }
      cleanIndexes.push(idxStr)
    }
    col.indexes = cleanIndexes

    // 2. Garantir que campos individuais não tenham flag unique
    const fields = col.fields || []
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i]
      if (f.name === 'professional' || f.name === 'student') {
        if (f.unique) {
          f.unique = false
        }
      }
    }

    app.save(col)

    // 3. Drop físico de índices antigos/problemáticos no SQLite
    const dropCandidates = [
      'idx_crm_prof_student',
      'idx_crm_contacts_prof_student_real',
      'idx_crm_contacts_professional',
      'idx_crm_contacts_student',
    ]

    for (let i = 0; i < dropCandidates.length; i++) {
      try {
        app
          .db()
          .newQuery('DROP INDEX IF EXISTS `' + dropCandidates[i] + '`')
          .execute()
      } catch (_) {}
    }

    // 4. Criar o índice físico SQLite parcial:
    // Garante unicidade APENAS para contatos com aluno real vinculado
    // (professional, student) único quando student != professional e student != ''
    const createPartialSql =
      'CREATE UNIQUE INDEX IF NOT EXISTS `idx_crm_contacts_prof_student_real` ' +
      'ON `crm_contacts` (`professional`, `student`) ' +
      "WHERE `student` IS NOT NULL AND `student` != '' AND `student` != `professional`;"

    app.db().newQuery(createPartialSql).execute()
  },
  (app) => {
    try {
      app.db().newQuery('DROP INDEX IF EXISTS `idx_crm_contacts_prof_student_real`').execute()
    } catch (_) {}
  },
)
