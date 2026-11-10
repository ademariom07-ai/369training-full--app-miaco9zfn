/// <reference path="../pb_data/types.d.ts" />

/**
 * CRM BackOffice 369WELLNESS — Endpoints (JSVM inline, sem transações):
 * 1. POST /backend/v1/crm/capture_lead  -> captura automática de lead quando não-vinculado chama no chat
 * 2. POST /backend/v1/crm/summary       -> totais por status, follow-ups de hoje/vencidos, conversão do mês
 * 3. POST /backend/v1/crm/admin_overview-> painel admin: alunos e parceiros por categoria + conversão
 *
 * Regras de segurança: cada profissional só lê/escreve SEUS contatos (filtro por professional = auth.id).
 * IMPORTANTE (JSVM PocketBase): TODA lógica fica inline nos callbacks do routerAdd — funções de
 * top-level não são visíveis dentro dos callbacks (pool de VMs separado).
 * IMPORTANTE: records usam record.id (nunca .getId()).
 */

routerAdd(
  'POST',
  '/backend/v1/crm/capture_lead',
  (e) => {
    const auth = e.auth
    if (!auth) return e.json(401, { error: 'Não autenticado' })

    try {
      const body = e.requestInfo().body || {}
      const professionalId = body.professional_id
      const contactMessage = (body.message || '').substring(0, 500)

      if (!professionalId) {
        return e.badRequestError('professional_id obrigatório')
      }

      const prof = $app.findRecordById('users', professionalId)
      if (!prof || prof.getString('role') !== 'profissional') {
        return e.badRequestError('Profissional inválido')
      }

      // Não captura se o aluno já é vinculado deste profissional
      const linked = auth.get('linked_professional')
      if (linked && linked === professionalId) {
        return e.json(200, { created: false, reason: 'already_linked' })
      }

      // Anti-duplicidade: já existe contato para este par?
      const existing = $app.findFirstRecordByFilter(
        'crm_contacts',
        "professional = '" + professionalId + "' && student = '" + auth.id + "'",
      )
      if (existing) {
        return e.json(200, {
          created: false,
          reason: 'already_exists',
          contact_id: existing.id,
        })
      }

      // Categoria pelo registro do profissional (CRP > CREFITO > especialidade)
      let category = 'personal_trainer'
      const specialties = prof.get('specialties') || []
      const specStr = Array.isArray(specialties) ? specialties.join(' ') : String(specialties || '')
      if (prof.getString('crp')) category = 'psicologo'
      else if (prof.getString('crefito')) category = 'fisioterapeuta'
      else if (specStr.indexOf('Nutri') !== -1) category = 'nutricionista'
      else if (specStr.indexOf('Artes Marciais') !== -1 || specStr.indexOf('marcial') !== -1)
        category = 'professor_artes_marciais'

      const col = $app.findCollectionByNameOrId('crm_contacts')
      const rec = new Record(col)
      rec.set('professional', professionalId)
      rec.set('student', auth.id)
      rec.set('contact_name', auth.get('name') || 'Lead')
      rec.set('category', category)
      rec.set('status', 'novo')
      rec.set('origin', 'chat')
      rec.set('notes', contactMessage ? 'Primeira mensagem: ' + contactMessage : '')
      $app.save(rec)

      console.log('[CRM] lead capturado: prof=' + professionalId + ' student=' + auth.id)

      return e.json(200, { created: true, contact_id: rec.id, status: 'novo' })
    } catch (err) {
      console.log('[CRM] capture_lead erro: ' + (err && err.message))
      return e.json(500, { error: 'Erro ao capturar lead' })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/crm/summary',
  (e) => {
    const auth = e.auth
    if (!auth) return e.json(401, { error: 'Não autenticado' })

    try {
      const body = e.requestInfo().body || {}
      const category = body.category || null
      const profId = auth.id
      const today = new Date().toISOString().slice(0, 10)
      const monthStart = today.slice(0, 7) + '-01'

      let filter = "professional = '" + profId + "'"
      if (category) {
        filter += " && category = '" + category + "'"
      }

      const all = $app.findRecordsByFilter('crm_contacts', filter, '-updated', 200, 0)

      const counts = { novo: 0, em_contato: 0, ativo: 0, inativo: 0, total: 0 }
      let wonThisMonth = 0
      let pipelineValue = 0
      const todayFollowups = []

      for (let i = 0; i < all.length; i++) {
        const c = all[i]
        const status = c.getString('status') || 'novo'
        counts.total++
        if (counts[status] !== undefined) counts[status]++

        const fu = c.get('next_followup_at')
        if (fu) {
          const fuDate = new Date(fu).toISOString().slice(0, 10)
          if (fuDate <= today) {
            todayFollowups.push({
              id: c.id,
              name: c.getString('contact_name'),
              status: status,
              followup_date: fuDate,
              overdue: fuDate < today,
              notes: c.getString('notes'),
              estimated_value: c.getFloat('estimated_value'),
            })
          }
        }

        if (status === 'ativo') pipelineValue += c.getFloat('estimated_value')

        const created = new Date(c.get('created'))
        if (status === 'ativo' && created.toISOString().slice(0, 7) === today.slice(0, 7)) {
          wonThisMonth++
        }
      }

      todayFollowups.sort(function (a, b) {
        return a.followup_date < b.followup_date ? -1 : 1
      })

      const contacted = counts.em_contato + counts.ativo
      const conversionRate = counts.total > 0 ? Math.round((contacted / counts.total) * 100) : 0
      const overdueCount = todayFollowups.filter(function (f) {
        return f.overdue
      }).length

      return e.json(200, {
        counts: counts,
        followups_today: todayFollowups,
        followups_today_count: todayFollowups.length,
        followups_overdue_count: overdueCount,
        won_this_month: wonThisMonth,
        pipeline_value: Math.round(pipelineValue * 100) / 100,
        conversion_rate: conversionRate,
        month: today.slice(0, 7),
        professional_id: profId,
        category: category,
      })
    } catch (err) {
      console.log('[CRM] summary erro: ' + (err && err.message))
      return e.json(500, { error: 'Erro ao carregar resumo do CRM' })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/crm/admin_overview',
  (e) => {
    const auth = e.auth
    if (!auth) return e.json(401, { error: 'Não autenticado' })

    try {
      const userRec = $app.findRecordById('users', auth.id)
      if (userRec.getString('role') !== 'admin') {
        return e.json(403, { error: 'Acesso restrito a administradores' })
      }

      const CATEGORIES = [
        'personal_trainer',
        'nutricionista',
        'fisioterapeuta',
        'psicologo',
        'professor_artes_marciais',
      ]
      const today = new Date().toISOString()
      const todayDate = today.slice(0, 10)
      const currentMonth = today.slice(0, 7)

      const byCategory = []
      let grandTotalContacts = 0
      let grandTotalWon = 0

      for (let ci = 0; ci < CATEGORIES.length; ci++) {
        const cat = CATEGORIES[ci]
        const contacts = $app.findRecordsByFilter(
          'crm_contacts',
          "category = '" + cat + "'",
          '-updated',
          500,
          0,
        )

        const counts = { novo: 0, em_contato: 0, ativo: 0, inativo: 0 }
        let won = 0
        let overdue = 0
        const profIds = {}

        for (let i = 0; i < contacts.length; i++) {
          const c = contacts[i]
          const status = c.getString('status')
          counts[status] = (counts[status] || 0) + 1
          profIds[c.getString('professional')] = true
          const fu = c.get('next_followup_at')
          if (fu && new Date(fu).toISOString().slice(0, 10) < todayDate) overdue++
          const created = new Date(c.get('created'))
          if (status === 'ativo' && created.toISOString().slice(0, 7) === currentMonth) won++
        }

        const total = contacts.length
        const contacted = counts.em_contato + counts.ativo
        const conversion = total > 0 ? Math.round((contacted / total) * 100) : 0

        byCategory.push({
          category: cat,
          total_contacts: total,
          professionals: Object.keys(profIds).length,
          counts: counts,
          won_this_month: won,
          overdue_followups: overdue,
          conversion_rate: conversion,
        })

        grandTotalContacts += total
        grandTotalWon += won
      }

      // Profissionais por categoria + ciclo de vida
      const pros = $app.findRecordsByFilter('users', "role = 'profissional'", '-created', 300, 0)
      const prosByCategory = {
        personal_trainer: 0,
        nutricionista: 0,
        fisioterapeuta: 0,
        psicologo: 0,
        professor_artes_marciais: 0,
      }
      const prosLifecycle = { novo: 0, ativo: 0, inativo: 0 }
      let linkedStudents = 0

      for (let i = 0; i < pros.length; i++) {
        const p = pros[i]
        const crp = p.getString('crp')
        const crefito = p.getString('crefito')
        const specialties = p.get('specialties') || []
        const specStr = Array.isArray(specialties)
          ? specialties.join(' ')
          : String(specialties || '')
        let cat = 'personal_trainer'
        if (crp) cat = 'psicologo'
        else if (crefito) cat = 'fisioterapeuta'
        else if (specStr.indexOf('Nutri') !== -1) cat = 'nutricionista'
        else if (specStr.indexOf('Artes Marciais') !== -1 || specStr.indexOf('marcial') !== -1)
          cat = 'professor_artes_marciais'

        prosByCategory[cat]++
        const approved = p.getBool('approved')
        const plan = (p.getString('plan') || 'gratis').toLowerCase()
        if (approved && plan !== 'gratis') prosLifecycle.ativo++
        else if (approved) prosLifecycle.novo++
        else prosLifecycle.inativo++

        const linked = $app.findRecordsByFilter(
          'users',
          "role = 'aluno' && linked_professional = '" + p.id + "'",
          '-created',
          50,
          0,
        )
        linkedStudents += linked.length
      }

      const alunos = $app.findRecordsByFilter('users', "role = 'aluno'", '-created', 500, 0)
      const alunosLifecycle = { ativo: 0, inadimplente: 0, cancelado: 0, sem_vinculo: 0 }
      for (let i = 0; i < alunos.length; i++) {
        const a = alunos[i]
        const sub = a.getString('subscription_status')
        if (sub === 'inadimplente') alunosLifecycle.inadimplente++
        else if (sub === 'cancelada') alunosLifecycle.cancelado++
        else if (!a.get('linked_professional')) alunosLifecycle.sem_vinculo++
        else alunosLifecycle.ativo++
      }

      return e.json(200, {
        month: currentMonth,
        by_category: byCategory,
        totals: {
          contacts: grandTotalContacts,
          won_this_month: grandTotalWon,
          professionals:
            prosByCategory.personal_trainer +
            prosByCategory.nutricionista +
            prosByCategory.fisioterapeuta +
            prosByCategory.psicologo +
            prosByCategory.professor_artes_marciais,
          linked_students: linkedStudents,
        },
        professionals_by_category: prosByCategory,
        professionals_lifecycle: prosLifecycle,
        students_lifecycle: alunosLifecycle,
      })
    } catch (err) {
      console.log('[CRM] admin_overview erro: ' + (err && err.message))
      return e.json(500, { error: 'Erro ao carregar visão geral' })
    }
  },
  $apis.requireAuth(),
)
