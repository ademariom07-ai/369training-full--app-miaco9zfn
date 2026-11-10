/// <reference path="../pb_data/types.d.ts" />

/**
 * CRM: múltiplos leads externos por profissional.
 *
 * Antes: índice único por (professional, student) permitia apenas 1 contato
 * externo (lead manual sem aluno vinculado, gravado com student = professional)
 * por profissional — o segundo recebia erro de unicidade.
 *
 * Agora: o índice único passa a ser PARCIAL — só se aplica quando o contato
 * tem um aluno REAL vinculado (student != professional). Assim:
 *  - o mesmo aluno continua não podendo virar contato duplicado do mesmo
 *    profissional (proteção mantida para captura via chat e vínculo);
 *  - o profissional pode criar N leads externos (student = professional).
 */

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('crm_contacts')

    // Remove o índice único antigo, se existir (idempotente).
    const old = col.indexes.filter(function (idx) {
      return idx.indexOf('idx_crm_prof_student') === -1
    })
    col.indexes = old

    // Índice parcial: unicidade só para pares com aluno real vinculado.
    // (SQL completo via col.indexes — o addIndex da JSVM não aceita WHERE aqui.)
    col.indexes = old.concat([
      'CREATE UNIQUE INDEX idx_crm_prof_student_linked ON crm_contacts (professional, student) ' +
        'WHERE student IS NOT NULL AND student <> professional',
      'CREATE INDEX idx_crm_prof_external ON crm_contacts (professional, contact_name) ' +
        "WHERE student = professional AND contact_name != ''",
    ])

    app.save(col)
    console.log(
      '[migr-0143] crm_contacts indexes: ' +
        JSON.stringify(app.findCollectionByNameOrId('crm_contacts').indexes),
    )
  },
  (app) => {
    // Reverte: volta ao índice único incondicional (professional, student).
    const col = app.findCollectionByNameOrId('crm_contacts')
    const keep = col.indexes.filter(function (idx) {
      return (
        idx.indexOf('idx_crm_prof_student_linked') === -1 &&
        idx.indexOf('idx_crm_prof_external') === -1
      )
    })
    col.indexes = keep
    col.addIndex('idx_crm_prof_student', true, 'professional, student', '')
    app.save(col)
  },
)
