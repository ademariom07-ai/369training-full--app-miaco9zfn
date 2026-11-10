/// <reference path="../pb_data/types.d.ts" />

/**
 * CRM BACKOFFICE 369WELLNESS — migração idempotente (no-op em base vazia):
 * 1. Coleção crm_contacts com regras: cada profissional lê/escreve apenas SEUS contatos.
 * 2. Agente nativo Skip Cloud "backoffice-pro-369" para o BackOffice do profissional.
 */

migrate(
  (app) => {
    // ---------- 1. COLEÇÃO crm_contacts ----------
    let collection = null
    try {
      collection = app.findCollectionByNameOrId('crm_contacts')
    } catch (_) {
      collection = new Collection({
        name: 'crm_contacts',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (professional = @request.auth.id || @request.auth.role = 'admin')",
        viewRule:
          "@request.auth.id != '' && (professional = @request.auth.id || @request.auth.role = 'admin')",
        createRule:
          "@request.auth.id != '' && @request.body.professional = @request.auth.id && @request.body.status = 'novo' && @request.body.origin = 'chat'",
        updateRule: "@request.auth.id != '' && professional = @request.auth.id",
        deleteRule: "@request.auth.id != '' && professional = @request.auth.id",
        fields: [
          {
            name: 'professional',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
            cascadeDelete: false,
          },
          {
            name: 'student',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
            cascadeDelete: false,
          },
          { name: 'contact_name', type: 'text', required: true, max: 200 },
          {
            name: 'category',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: [
              'personal_trainer',
              'nutricionista',
              'fisioterapeuta',
              'psicologo',
              'professor_artes_marciais',
            ],
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['novo', 'em_contato', 'ativo', 'inativo'],
          },
          {
            name: 'origin',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['vinculo', 'chat', 'perfil'],
          },
          { name: 'notes', type: 'text', required: false, max: 2000 },
          { name: 'next_followup_at', type: 'date', required: false },
          { name: 'estimated_value', type: 'number', required: false, onlyInt: false },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_crm_prof_student ON crm_contacts (professional, student)',
          'CREATE INDEX idx_crm_prof_status ON crm_contacts (professional, status)',
          'CREATE INDEX idx_crm_followup ON crm_contacts (professional, next_followup_at)',
        ],
      })
      app.save(collection)
      console.log('[migr-0137] coleção crm_contacts criada')
    }

    // ---------- 2. AGENTE NATIVO BACKOFFICE ----------
    // API oficial Skip Cloud: $ai.agents.define (idempotente, upsert por slug).
    // Nunca consultar a coleção ai_agents diretamente (ela pode não existir neste ponto).
    // A coleção crm_contacts acima já foi criada — o agente não bloqueia a migração:
    // falhas aqui são tratadas silenciosamente (o hook tem fallback $ai.chat).
    try {
      $ai.agents.define(app, {
        slug: 'backoffice-pro-369',
        name: 'BackOffice 369 — Assistente do Profissional',
        description:
          'Assistente de backoffice do profissional parceiro 369WELLNESS: carteira de clientes, follow-ups do CRM, resumo de alunos e leads parados.',
        systemPrompt: [
          'Você é o BACKOFFICE 369, assistente interno do profissional parceiro da 369WELLNESS.',
          'Você responde EXCLUSIVAMENTE com base nos dados do próprio profissional fornecidos no contexto (contatos CRM, serviços, agendamentos).',
          'Nunca invente dados. Nunca exponha dados de outros profissionais ou usuários.',
          'Funções: responder dúvidas sobre a carteira, sugerir follow-ups (priorizando vencidos), resumir alunos e apontar leads parados.',
          'Responda sempre em português, de forma curta e objetiva, adequada a celular.',
        ].join('\n'),
        tier: 'fast',
      })
      console.log('[migr-0137] agente nativo backoffice-pro-369 definido')
    } catch (agentErr) {
      console.log(
        '[migr-0137] agente nativo não definido (fallback $ai.chat ativo): ' +
          (agentErr && agentErr.message),
      )
    }
  },
  (app) => {
    // rollback: remove agente e coleção (reversível, seguro em base nova)
    try {
      $ai.agents.delete(app, 'backoffice-pro-369')
    } catch (_) {}
    try {
      const col = $app.findCollectionByNameOrId('crm_contacts')
      $app.delete(col)
    } catch (_) {}
  },
)
