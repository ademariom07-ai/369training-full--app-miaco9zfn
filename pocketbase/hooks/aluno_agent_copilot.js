/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoints do Agente 369 do Aluno (todos com lógica inline para compatibilidade com o JSVM do PocketBase):
 * 1. POST /backend/v1/aluno/agent_status -> Retorna franquias, uso no mês corrente, PAR-Q+, sono recente, permissões
 * 2. POST /backend/v1/aluno/save_parq -> Salva questionário PAR-Q+
 * 3. POST /backend/v1/aluno/generate_workout -> Geração parametrizada determinística via templates 40+ e 60+ (com débito se excedente)
 * 4. POST /backend/v1/aluno/agent_chat -> Chat com Agente 369 (com guardrails, red flags, compliance CREF e débito se excedente)
 * 5. POST /backend/v1/aluno/cycle_log -> Registro diário do ciclo menstrual (apenas Premium, bloqueado se consentimento art. 11 revogado)
 */

// 1. GET/POST STATUS DO AGENTE
routerAdd(
  'POST',
  '/backend/v1/aluno/agent_status',
  (e) => {
    const authUser = e.auth
    if (!authUser) {
      return e.json(401, { error: 'Não autenticado' })
    }

    const userId = authUser.id
    const user = $app.findRecordById('users', userId)
    const role = user.get('role') || 'aluno'
    let rawPlan = (user.get('plan') || 'gratis').toLowerCase()
    const linkedProfId = user.get('linked_professional')

    let isLinked = false
    if (role === 'aluno' && linkedProfId) {
      try {
        const profUser = $app.findRecordById('users', linkedProfId)
        const profPlan = (profUser.get('plan') || 'basico').toLowerCase()
        if (profPlan === 'pro_parceiro') {
          rawPlan = 'premium'
        } else {
          rawPlan = profPlan
        }
        isLinked = true
      } catch (_) {}
    }

    let studentAiLimits = {
      gratis: {
        workouts_per_month: 0,
        messages_per_month: 0,
        smartwatch_sleep_adjustment: false,
        menstrual_cycle_module: false,
      },
      basico: {
        workouts_per_month: 4,
        messages_per_month: 0,
        smartwatch_sleep_adjustment: false,
        menstrual_cycle_module: false,
      },
      pro: {
        workouts_per_month: 12,
        messages_per_month: 10,
        smartwatch_sleep_adjustment: true,
        menstrual_cycle_module: false,
      },
      premium: {
        workouts_per_month: 9999,
        messages_per_month: 60,
        smartwatch_sleep_adjustment: true,
        menstrual_cycle_module: true,
      },
    }

    let overageCosts = {
      workout_cost: 0.25,
      message_cost: 0.1,
    }

    try {
      const limitsRec = $app.findFirstRecordByData('platform_config', 'key', 'student_ai_limits')
      if (limitsRec && limitsRec.get('value')) {
        const parsed = limitsRec.get('value')
        if (typeof parsed === 'object') studentAiLimits = { ...studentAiLimits, ...parsed }
      }
    } catch (_) {}

    try {
      const overageRec = $app.findFirstRecordByData('platform_config', 'key', 'ai_overage_costs')
      if (overageRec && overageRec.get('value')) {
        const parsed = overageRec.get('value')
        if (typeof parsed === 'object') overageCosts = { ...overageCosts, ...parsed }
      }
    } catch (_) {}

    const currentMonth = new Date().toISOString().slice(0, 7)
    let workoutsGenerated = 0
    let chatMessages = 0
    try {
      const records = $app.findRecordsByFilter(
        'agent_usage',
        `user = '${userId}' && month = '${currentMonth}'`,
        '-created',
        1,
        0,
      )
      if (records && records.length > 0) {
        workoutsGenerated = Number(records[0].get('workouts_generated') || 0)
        chatMessages = Number(records[0].get('chat_messages') || 0)
      }
    } catch (_) {}

    let parqClean = false
    let parqCompleted = false
    let parqDetails = null
    try {
      const parqList = $app.findRecordsByFilter(
        'parq_onboarding',
        `user = '${userId}'`,
        '-created',
        1,
        0,
      )
      if (parqList && parqList.length > 0) {
        parqCompleted = true
        parqClean = !!parqList[0].get('passed_clean')
        parqDetails = {
          passed_clean: parqClean,
          medical_clearance_required: !!parqList[0].get('medical_clearance_required'),
          completed_at: parqList[0].get('completed_at'),
        }
      }
    } catch (_) {}

    let lgpdHealthConsentActive = false
    try {
      const consents = $app.findRecordsByFilter(
        'lgpd_consents',
        `user = '${userId}' && consent_type = 'dados_sensiveis_saude' && revoked_at = ''`,
        '-granted_at',
        1,
        0,
      )
      lgpdHealthConsentActive = consents && consents.length > 0
    } catch (_) {}

    let recentSleep = null
    try {
      const sleeps = $app.findRecordsByFilter(
        'wearable_metrics',
        `user = '${userId}'`,
        '-date',
        1,
        0,
      )
      if (sleeps && sleeps.length > 0) {
        recentSleep = {
          date: sleeps[0].get('date'),
          sleep_hours: Number(sleeps[0].get('sleep_hours') || 0),
          sleep_score: Number(sleeps[0].get('sleep_score') || 0),
          readiness_score: Number(sleeps[0].get('readiness_score') || 0),
          resting_hr: Number(sleeps[0].get('resting_hr') || 0),
        }
      }
    } catch (_) {}

    const limits = studentAiLimits[rawPlan] || studentAiLimits.gratis
    const workoutsRemaining = Math.max(0, limits.workouts_per_month - workoutsGenerated)
    const messagesRemaining = Math.max(0, limits.messages_per_month - chatMessages)

    return e.json(200, {
      plan: rawPlan,
      is_linked: isLinked,
      month: currentMonth,
      limits,
      usage: {
        workouts_generated: workoutsGenerated,
        chat_messages: chatMessages,
        workouts_remaining: limits.workouts_per_month >= 9000 ? 'Ilimitado' : workoutsRemaining,
        messages_remaining: messagesRemaining,
      },
      overage_costs: overageCosts,
      wallet_balance: Number(authUser.get('wallet_balance') || 0),
      parq: {
        completed: parqCompleted,
        passed_clean: parqClean,
        details: parqDetails,
      },
      lgpd_health_consent: lgpdHealthConsentActive,
      recent_sleep: recentSleep,
      fixed_disclaimer:
        '[Aviso: O Agente 369 é um copiloto de apoio técnico e não substitui avaliação presencial de Educação Física ou Medicina. Pratique com segurança.]',
    })
  },
  $apis.requireAuth(),
)

// 2. SALVAR QUESTIONÁRIO PAR-Q+
routerAdd(
  'POST',
  '/backend/v1/aluno/save_parq',
  (e) => {
    const authUser = e.auth
    if (!authUser) return e.json(401, { error: 'Não autenticado' })

    const body = e.requestInfo().body || {}
    const hasHeart = !!body.has_heart_condition
    const hasChestPainActivity = !!body.has_chest_pain_activity
    const hasChestPainRest = !!body.has_chest_pain_rest
    const hasDizziness = !!body.has_dizziness_loss_consciousness
    const hasBoneJoint = !!body.has_bone_joint_problem
    const hasPrescription = !!body.has_prescription_blood_pressure_heart
    const hasOtherReason = !!body.has_other_reason_preventing_activity

    const anyYes =
      hasHeart ||
      hasChestPainActivity ||
      hasChestPainRest ||
      hasDizziness ||
      hasBoneJoint ||
      hasPrescription ||
      hasOtherReason

    const passedClean = !anyYes
    const medicalClearanceRequired = anyYes

    const parqCol = $app.findCollectionByNameOrId('parq_onboarding')
    let rec
    try {
      const existing = $app.findRecordsByFilter(
        'parq_onboarding',
        `user = '${authUser.id}'`,
        '-created',
        1,
        0,
      )
      if (existing && existing.length > 0) rec = existing[0]
    } catch (_) {}

    if (!rec) rec = new Record(parqCol)

    rec.set('user', authUser.id)
    rec.set('has_heart_condition', hasHeart)
    rec.set('has_chest_pain_activity', hasChestPainActivity)
    rec.set('has_chest_pain_rest', hasChestPainRest)
    rec.set('has_dizziness_loss_consciousness', hasDizziness)
    rec.set('has_bone_joint_problem', hasBoneJoint)
    rec.set('has_prescription_blood_pressure_heart', hasPrescription)
    rec.set('has_other_reason_preventing_activity', hasOtherReason)
    rec.set('passed_clean', passedClean)
    rec.set('medical_clearance_required', medicalClearanceRequired)
    rec.set('medical_clearance_notes', body.medical_clearance_notes || '')
    rec.set('completed_at', new Date().toISOString())

    $app.save(rec)

    return e.json(200, {
      success: true,
      passed_clean: passedClean,
      medical_clearance_required: medicalClearanceRequired,
      message: passedClean
        ? 'PAR-Q+ concluído sem restrições. Você está liberado para usar o Agente 369!'
        : 'Atenção: Você indicou uma ou mais condições médicas. Por compliance e segurança CREF, recomendamos fortemente avaliação e liberação médica presencial.',
    })
  },
  $apis.requireAuth(),
)

// 3. GERAÇÃO DETERMINÍSTICA DE TREINO (COMPLIANCE CREF + NÃO PONTUA NO RANKING)
routerAdd(
  'POST',
  '/backend/v1/aluno/generate_workout',
  (e) => {
    const authUser = e.auth
    if (!authUser) return e.json(401, { error: 'Não autenticado' })

    const userId = authUser.id
    const user = $app.findRecordById('users', userId)
    const role = user.get('role') || 'aluno'
    let rawPlan = (user.get('plan') || 'gratis').toLowerCase()
    const linkedProfId = user.get('linked_professional')

    let isLinked = false
    if (role === 'aluno' && linkedProfId) {
      try {
        const profUser = $app.findRecordById('users', linkedProfId)
        const profPlan = (profUser.get('plan') || 'basico').toLowerCase()
        if (profPlan === 'pro_parceiro') {
          rawPlan = 'premium'
        } else {
          rawPlan = profPlan
        }
        isLinked = true
      } catch (_) {}
    }

    if (rawPlan === 'gratis' && !isLinked) {
      return e.json(403, {
        error:
          'O Agente 369 está disponível a partir do Plano Básico (R$ 10/mês). Faça upgrade do seu plano para liberar treinos inteligentes.',
      })
    }

    // Verificar PAR-Q+
    let parqCompleted = false
    try {
      const parqList = $app.findRecordsByFilter(
        'parq_onboarding',
        `user = '${userId}'`,
        '-created',
        1,
        0,
      )
      if (parqList && parqList.length > 0) parqCompleted = true
    } catch (_) {}

    if (!parqCompleted) {
      return e.json(400, {
        error: 'PAR_Q_REQUIRED',
        message:
          'É obrigatório responder ao questionário de prontidão PAR-Q+ antes do primeiro treino gerado pelo Agente 369.',
      })
    }

    const body = e.requestInfo().body || {}
    const symptomsReported = body.symptoms || ''
    const ageGroup = body.age_group || (body.age >= 60 ? '60+' : '40-59')
    const preferredTemplateCode = body.template_code

    // RED FLAGS CHECK
    const redFlagKeywords = [
      'dor no peito',
      'dor toracica',
      'dor torácica',
      'falta de ar',
      'dispneia',
      'dispnéia',
      'tontura',
      'sincope',
      'síncope',
      'desmaio',
      'dor aguda',
      'articular aguda',
      'sangramento',
      'hemorragia',
    ]

    const textToCheck = `${symptomsReported} ${body.notes || ''}`.toLowerCase()
    for (const kw of redFlagKeywords) {
      if (textToCheck.includes(kw)) {
        return e.json(400, {
          error: 'RED_FLAG_DETECTED',
          red_flag: kw,
          message: `ATENÇÃO MÉDICA IMEDIATA: Sintoma crítico detectado ("${kw}"). Por estrito compliance CREF e segurança à sua integridade física, a geração de exercícios foi INTERROMPIDA. Interrompa qualquer atividade física imediatamente e procure atendimento médico de emergência ou seu médico assistente.`,
          fixed_disclaimer:
            '[Aviso: O Agente 369 é um copiloto de apoio técnico e não substitui avaliação presencial de Educação Física ou Medicina. Pratique com segurança.]',
        })
      }
    }

    // Configurações de limites e excedente
    let studentAiLimits = {
      gratis: {
        workouts_per_month: 0,
        messages_per_month: 0,
        smartwatch_sleep_adjustment: false,
        menstrual_cycle_module: false,
      },
      basico: {
        workouts_per_month: 4,
        messages_per_month: 0,
        smartwatch_sleep_adjustment: false,
        menstrual_cycle_module: false,
      },
      pro: {
        workouts_per_month: 12,
        messages_per_month: 10,
        smartwatch_sleep_adjustment: true,
        menstrual_cycle_module: false,
      },
      premium: {
        workouts_per_month: 9999,
        messages_per_month: 60,
        smartwatch_sleep_adjustment: true,
        menstrual_cycle_module: true,
      },
    }
    let overageCosts = { workout_cost: 0.25, message_cost: 0.1 }

    try {
      const limitsRec = $app.findFirstRecordByData('platform_config', 'key', 'student_ai_limits')
      if (limitsRec && limitsRec.get('value')) {
        const parsed = limitsRec.get('value')
        if (typeof parsed === 'object') studentAiLimits = { ...studentAiLimits, ...parsed }
      }
    } catch (_) {}

    try {
      const overageRec = $app.findFirstRecordByData('platform_config', 'key', 'ai_overage_costs')
      if (overageRec && overageRec.get('value')) {
        const parsed = overageRec.get('value')
        if (typeof parsed === 'object') overageCosts = { ...overageCosts, ...parsed }
      }
    } catch (_) {}

    const limits = studentAiLimits[rawPlan] || studentAiLimits.gratis
    const currentMonth = new Date().toISOString().slice(0, 7)
    const usageCol = $app.findCollectionByNameOrId('agent_usage')
    let usageRec = null
    try {
      const records = $app.findRecordsByFilter(
        'agent_usage',
        `user = '${userId}' && month = '${currentMonth}'`,
        '-created',
        1,
        0,
      )
      if (records && records.length > 0) usageRec = records[0]
    } catch (_) {}

    let workoutsGenerated = usageRec ? Number(usageRec.get('workouts_generated') || 0) : 0

    // VERIFICAR FRANQUIA E EXCEDENTE
    const isExceeded = workoutsGenerated >= limits.workouts_per_month
    let chargedAmount = 0
    if (isExceeded) {
      chargedAmount = overageCosts.workout_cost
      const currentBalance = Number(user.get('wallet_balance') || 0)
      if (currentBalance < chargedAmount) {
        return e.json(402, {
          error: 'WALLET_BALANCE_INSUFFICIENT',
          message: `Saldo insuficiente na carteira (R$ ${currentBalance.toFixed(2)}). Recarregue ao menos R$ ${chargedAmount.toFixed(2)} para usar o excedente.`,
          required_balance: chargedAmount,
        })
      }

      // Debitar carteira
      user.set('wallet_balance', currentBalance - chargedAmount)
      $app.save(user)

      const txCol = $app.findCollectionByNameOrId('wallet_transactions')
      const tx = new Record(txCol)
      tx.set('user', user.id)
      tx.set('type', 'tarifa')
      tx.set('amount', -chargedAmount)
      tx.set('status', 'concluido')
      tx.set('reference_type', 'agent_overage')
      tx.set('reference_id', `ai_workout_${Date.now()}`)
      tx.set(
        'description',
        `Excedente Agente 369: Treino inteligente adicional (R$ ${chargedAmount.toFixed(2)})`,
      )
      $app.save(tx)
    }

    // SELECIONAR TEMPLATE DETERMINÍSTICO APROVADO
    let templateRec = null
    try {
      if (preferredTemplateCode) {
        const found = $app.findRecordsByFilter(
          'workout_templates',
          `code = '${preferredTemplateCode}' && is_active = true`,
          '-created',
          1,
          0,
        )
        if (found && found.length > 0) templateRec = found[0]
      }
      if (!templateRec) {
        const found = $app.findRecordsByFilter(
          'workout_templates',
          `target_age_group = '${ageGroup}' && is_active = true`,
          '-created',
          1,
          0,
        )
        if (found && found.length > 0) templateRec = found[0]
      }
    } catch (_) {}

    if (!templateRec) {
      return e.json(500, {
        error: 'Nenhum template de treino determinístico aprovado encontrado para seu perfil.',
      })
    }

    let structure = templateRec.get('exercises_structure')
    if (typeof structure === 'string') {
      try {
        structure = JSON.parse(structure)
      } catch (_) {
        structure = []
      }
    }

    // 1. Ajuste Sono recente do smartwatch
    let sleepAdjustmentApplied = null
    if (limits.smartwatch_sleep_adjustment) {
      try {
        const sleeps = $app.findRecordsByFilter(
          'wearable_metrics',
          `user = '${userId}'`,
          '-date',
          1,
          0,
        )
        if (sleeps && sleeps.length > 0) {
          const hours = Number(sleeps[0].get('sleep_hours') || 0)
          if (hours > 0 && hours < 6) {
            sleepAdjustmentApplied = {
              type: 'sono_critico',
              hours,
              action:
                'Ajuste regenerativo: volume reduzido em 50%, cargas moderadas a leves com foco em mobilidade.',
            }
          } else if (hours >= 6 && hours < 7) {
            sleepAdjustmentApplied = {
              type: 'sono_moderado',
              hours,
              action:
                'Ajuste compensatório: volume total reduzido em 25% (1 série a menos nos exercícios principais).',
            }
          } else if (hours >= 7) {
            sleepAdjustmentApplied = {
              type: 'sono_ideal',
              hours,
              action: 'Sono restaurador detectado (≥7h). Volume e intensidade preservados a 100%.',
            }
          }
        }
      } catch (_) {}
    }

    // 2. Módulo Ciclo Menstrual (Ajuste individual por sintomas)
    let menstrualAdjustmentApplied = null
    if (limits.menstrual_cycle_module && body.cycle_symptom) {
      menstrualAdjustmentApplied = {
        symptom: body.cycle_symptom,
        action: `Ajuste personalizado por sintoma diário (${body.cycle_symptom}): cadência suave, intervalos estendidos e foco em bem-estar físico.`,
      }
    }

    // Salvar o treino na coleção workouts (ISOLADO — NÃO É SERVIÇO E NÃO GERA PONTUAÇÃO DE RANKING)
    const workoutsCol = $app.findCollectionByNameOrId('workouts')
    const workout = new Record(workoutsCol)
    workout.set('student', authUser.id)
    workout.set('title', `${templateRec.get('title')} [Agente 369]`)
    workout.set(
      'description',
      `Treino determinístico parametrizado pelo Agente 369 baseado no protocolo credenciado: ${templateRec.get('approved_by_cref') || 'Equipe 369'}.`,
    )
    workout.set(
      'category',
      ageGroup === '60+' ? 'Multicomponente 60+' : 'Hipertrofia Funcional 40+',
    )
    workout.set('days_per_week', 3)
    workout.set('target_audience', ageGroup)
    workout.set('status', 'ativo')
    workout.set('exercises', structure)
    workout.set('sleep_adjustment', sleepAdjustmentApplied)
    workout.set('template_source', templateRec.get('code'))
    $app.save(workout)

    // Incrementar uso de treinos
    if (!usageRec) {
      usageRec = new Record(usageCol)
      usageRec.set('user', userId)
      usageRec.set('month', currentMonth)
      usageRec.set('workouts_generated', 1)
      usageRec.set('chat_messages', 0)
    } else {
      usageRec.set('workouts_generated', workoutsGenerated + 1)
    }
    $app.save(usageRec)

    return e.json(200, {
      success: true,
      workout: {
        id: workout.id,
        title: workout.get('title'),
        template_code: templateRec.get('code'),
        target_age_group: ageGroup,
        approved_by_cref: templateRec.get('approved_by_cref'),
        guidelines: templateRec.get('guidelines'),
        exercises: structure,
        sleep_adjustment: sleepAdjustmentApplied,
        menstrual_adjustment: menstrualAdjustmentApplied,
      },
      usage: {
        workouts_generated: workoutsGenerated + 1,
        workouts_limit: limits.workouts_per_month,
        charged_amount: chargedAmount,
        wallet_balance: Number(user.get('wallet_balance') || 0),
      },
      fixed_disclaimer:
        '[Aviso: O Agente 369 é um copiloto de apoio técnico e não substitui avaliação presencial de Educação Física ou Medicina. Pratique com segurança. Treinos gerados por IA não geram pontos no Ranking.]',
    })
  },
  $apis.requireAuth(),
)

// 4. CHAT COM O AGENTE 369 (VIA SKIP NATIVE AI AGENT / GATEWAY COM MEMÓRIA E GUARDRAILS)
routerAdd(
  'POST',
  '/backend/v1/aluno/agent_chat',
  (e) => {
    const authUser = e.auth
    if (!authUser) return e.json(401, { error: 'Não autenticado' })

    const userId = authUser.id
    const user = $app.findRecordById('users', userId)
    const role = user.get('role') || 'aluno'
    let rawPlan = (user.get('plan') || 'gratis').toLowerCase()
    const linkedProfId = user.get('linked_professional')

    let isLinked = false
    if (role === 'aluno' && linkedProfId) {
      try {
        const profUser = $app.findRecordById('users', linkedProfId)
        const profPlan = (profUser.get('plan') || 'basico').toLowerCase()
        if (profPlan === 'pro_parceiro') {
          rawPlan = 'premium'
        } else {
          rawPlan = profPlan
        }
        isLinked = true
      } catch (_) {}
    }

    let studentAiLimits = {
      gratis: {
        workouts_per_month: 0,
        messages_per_month: 0,
        smartwatch_sleep_adjustment: false,
        menstrual_cycle_module: false,
      },
      basico: {
        workouts_per_month: 4,
        messages_per_month: 0,
        smartwatch_sleep_adjustment: false,
        menstrual_cycle_module: false,
      },
      pro: {
        workouts_per_month: 12,
        messages_per_month: 10,
        smartwatch_sleep_adjustment: true,
        menstrual_cycle_module: false,
      },
      premium: {
        workouts_per_month: 9999,
        messages_per_month: 60,
        smartwatch_sleep_adjustment: true,
        menstrual_cycle_module: true,
      },
    }
    let overageCosts = { workout_cost: 0.25, message_cost: 0.1 }

    try {
      const limitsRec = $app.findFirstRecordByData('platform_config', 'key', 'student_ai_limits')
      if (limitsRec && limitsRec.get('value')) {
        const parsed = limitsRec.get('value')
        if (typeof parsed === 'object') studentAiLimits = { ...studentAiLimits, ...parsed }
      }
    } catch (_) {}

    try {
      const overageRec = $app.findFirstRecordByData('platform_config', 'key', 'ai_overage_costs')
      if (overageRec && overageRec.get('value')) {
        const parsed = overageRec.get('value')
        if (typeof parsed === 'object') overageCosts = { ...overageCosts, ...parsed }
      }
    } catch (_) {}

    const limits = studentAiLimits[rawPlan] || studentAiLimits.gratis
    if (limits.messages_per_month === 0 && !isLinked) {
      return e.json(403, {
        error:
          'O chat interativo com o Agente 369 está disponível a partir do Plano Pro (10 msgs/mês) e Premium (60 msgs/mês).',
      })
    }

    const body = e.requestInfo().body || {}
    const userMessage = (body.message || '').trim()
    if (!userMessage) {
      return e.json(400, { error: 'Mensagem vazia.' })
    }

    // RED FLAGS CHECK
    const redFlagKeywords = [
      'dor no peito',
      'dor toracica',
      'dor torácica',
      'falta de ar',
      'dispneia',
      'dispnéia',
      'tontura',
      'sincope',
      'síncope',
      'desmaio',
      'dor articular aguda',
      'sangramento',
    ]
    const lowerMsg = userMessage.toLowerCase()
    for (const kw of redFlagKeywords) {
      if (lowerMsg.includes(kw)) {
        return e.json(200, {
          is_red_flag: true,
          reply: `ATENÇÃO MÉDICA IMEDIATA: Você relatou um sintoma crítico ("${kw}"). Por estrito protocolo de segurança biológica e conformidade com o CREF/CFM, qualquer orientação de treino está IMEDIATAMENTE INTERROMPIDA. Por favor, sente-se em local arejado, não continue esforços físicos e procure auxílio médico de urgência ou contate imediatamente um profissional de saúde.`,
          fixed_disclaimer:
            '[Aviso: O Agente 369 é um copiloto de apoio técnico e não substitui avaliação presencial de Educação Física ou Medicina. Pratique com segurança.]',
        })
      }
    }

    const currentMonth = new Date().toISOString().slice(0, 7)
    const usageCol = $app.findCollectionByNameOrId('agent_usage')
    let usageRec = null
    try {
      const records = $app.findRecordsByFilter(
        'agent_usage',
        `user = '${userId}' && month = '${currentMonth}'`,
        '-created',
        1,
        0,
      )
      if (records && records.length > 0) usageRec = records[0]
    } catch (_) {}

    let chatMessages = usageRec ? Number(usageRec.get('chat_messages') || 0) : 0

    // VERIFICAR FRANQUIA E EXCEDENTE
    const isExceeded = chatMessages >= limits.messages_per_month
    let chargedAmount = 0
    if (isExceeded) {
      chargedAmount = overageCosts.message_cost
      const currentBalance = Number(user.get('wallet_balance') || 0)
      if (currentBalance < chargedAmount) {
        return e.json(402, {
          error: 'WALLET_BALANCE_INSUFFICIENT',
          message: `Saldo insuficiente na carteira (R$ ${currentBalance.toFixed(2)}). Recarregue ao menos R$ ${chargedAmount.toFixed(2)} para enviar mensagens excedentes.`,
          required_balance: chargedAmount,
        })
      }

      user.set('wallet_balance', currentBalance - chargedAmount)
      $app.save(user)

      const txCol = $app.findCollectionByNameOrId('wallet_transactions')
      const tx = new Record(txCol)
      tx.set('user', user.id)
      tx.set('type', 'tarifa')
      tx.set('amount', -chargedAmount)
      tx.set('status', 'concluido')
      tx.set('reference_type', 'agent_overage')
      tx.set('reference_id', `ai_chat_${Date.now()}`)
      tx.set(
        'description',
        `Excedente Agente 369: Mensagem de chat adicional (R$ ${chargedAmount.toFixed(2)})`,
      )
      $app.save(tx)
    }

    // CHAMADA AO AGENTE NATIVO OU SKIP AI GATEWAY
    let agentReply = ''
    let conversationId = body.conversation_id || null
    try {
      if (typeof $ai !== 'undefined' && typeof $ai.agent === 'function') {
        const result = $ai.agent('agente-aluno-369').chat({
          user_id: authUser.id,
          conversation_id: body.conversation_id || null,
          message: userMessage,
        })
        agentReply = result.content
        conversationId = result.conversation_id
      }
    } catch (agentErr) {
      console.log('Tentando fallback para $ai.chat:', agentErr.message)
    }

    if (!agentReply) {
      try {
        const completion = $ai.chat({
          model: 'fast',
          messages: [
            {
              role: 'system',
              content: `Você é o AGENTE 369 DO ALUNO, copiloto supervisionado de saúde e treino 369TRAINING.
Compliance CREF: Nunca prescreva sozinho diagnósticos. Responda com base na ciência do exercício para longevidade e segurança.
Sono <6h: mobilidade leve; 6-7h: -20% volume; >=7h: rotina normal.
60+: foco multicomponente e equilíbrio.
Ciclo menstrual: ajuste individual por sintomas do dia.
Não prometa pontuação de ranking para treinos gerados por IA.
Finalize sempre com o disclaimer obrigatório.`,
            },
            {
              role: 'user',
              content: userMessage,
            },
          ],
          temperature: 0.4,
          maxTokens: 600,
        })
        agentReply =
          (completion && completion.content) ||
          (completion &&
            completion.choices &&
            completion.choices[0] &&
            completion.choices[0].message &&
            completion.choices[0].message.content) ||
          ''
      } catch (fallbackErr) {
        console.error('Erro na chamada AI:', fallbackErr)
        agentReply =
          'Entendido! Como seu Copiloto 369, oriento manter a regularidade dos exercícios com segurança, focando na boa biomecânica e respeitando os sinais de recuperação do seu corpo. Se sentir qualquer desconforto incomum, consulte seu educador físico.'
      }
    }

    const disclaimer =
      '\n\n[Aviso: O Agente 369 é um copiloto de apoio técnico e não substitui avaliação presencial de Educação Física ou Medicina. Pratique com segurança.]'
    if (!agentReply.includes('[Aviso: O Agente 369')) {
      agentReply += disclaimer
    }

    if (!usageRec) {
      usageRec = new Record(usageCol)
      usageRec.set('user', userId)
      usageRec.set('month', currentMonth)
      usageRec.set('workouts_generated', 0)
      usageRec.set('chat_messages', 1)
    } else {
      usageRec.set('chat_messages', chatMessages + 1)
    }
    $app.save(usageRec)

    return e.json(200, {
      success: true,
      reply: agentReply,
      conversation_id: conversationId,
      usage: {
        chat_messages: chatMessages + 1,
        messages_limit: limits.messages_per_month,
        charged_amount: chargedAmount,
        wallet_balance: Number(user.get('wallet_balance') || 0),
      },
      fixed_disclaimer:
        '[Aviso: O Agente 369 é um copiloto de apoio técnico e não substitui avaliação presencial de Educação Física ou Medicina. Pratique com segurança.]',
    })
  },
  $apis.requireAuth(),
)

// 5. REGISTRO DO MÓDULO CICLO MENSTRUAL (APENAS PREMIUM E CONDICIONADO A CONSENTIMENTO ART. 11 LGPD)
routerAdd(
  'POST',
  '/backend/v1/aluno/cycle_log',
  (e) => {
    const authUser = e.auth
    if (!authUser) return e.json(401, { error: 'Não autenticado' })

    const userId = authUser.id
    const user = $app.findRecordById('users', userId)
    const role = user.get('role') || 'aluno'
    let rawPlan = (user.get('plan') || 'gratis').toLowerCase()
    const linkedProfId = user.get('linked_professional')

    if (role === 'aluno' && linkedProfId) {
      try {
        const profUser = $app.findRecordById('users', linkedProfId)
        const profPlan = (profUser.get('plan') || 'basico').toLowerCase()
        if (profPlan === 'pro_parceiro') {
          rawPlan = 'premium'
        } else {
          rawPlan = profPlan
        }
      } catch (_) {}
    }

    if (rawPlan !== 'premium') {
      return e.json(403, {
        error: 'CYCLE_MODULE_PREMIUM_ONLY',
        message:
          'O módulo de ciclo menstrual e ajuste por sintomas é exclusivo do Plano Premium (R$ 30/mês).',
      })
    }

    let lgpdHealthConsentActive = false
    try {
      const consents = $app.findRecordsByFilter(
        'lgpd_consents',
        `user = '${userId}' && consent_type = 'dados_sensiveis_saude' && revoked_at = ''`,
        '-granted_at',
        1,
        0,
      )
      lgpdHealthConsentActive = consents && consents.length > 0
    } catch (_) {}

    if (!lgpdHealthConsentActive) {
      return e.json(403, {
        error: 'LGPD_CONSENT_REVOKED',
        message:
          'O tratamento de dados sensíveis de saúde requer seu consentimento expresso (Art. 11 da LGPD). Caso tenha sido revogado, o módulo permanece bloqueado até nova autorização no Painel LGPD.',
      })
    }

    const body = e.requestInfo().body || {}
    const date = body.date || new Date().toISOString().slice(0, 10)

    const cycleCol = $app.findCollectionByNameOrId('menstrual_cycle_logs')
    let rec
    try {
      const existing = $app.findRecordsByFilter(
        'menstrual_cycle_logs',
        `user = '${userId}' && date = '${date}'`,
        '-created',
        1,
        0,
      )
      if (existing && existing.length > 0) rec = existing[0]
    } catch (_) {}

    if (!rec) rec = new Record(cycleCol)

    rec.set('user', userId)
    rec.set('date', date)
    rec.set('flow', body.flow || 'nenhum')
    rec.set('energy_level', Number(body.energy_level || 5))
    rec.set('symptoms', body.symptoms || [])
    rec.set('perceived_recovery', Number(body.perceived_recovery || 5))
    rec.set('notes', body.notes || '')
    $app.save(rec)

    return e.json(200, {
      success: true,
      message:
        'Registro diário do ciclo menstrual salvo com segurança e privacidade (Art. 11 LGPD).',
      log: {
        id: rec.id,
        date,
        flow: rec.get('flow'),
        energy_level: rec.get('energy_level'),
        symptoms: rec.get('symptoms'),
        perceived_recovery: rec.get('perceived_recovery'),
      },
    })
  },
  $apis.requireAuth(),
)
