/// <reference path="../pb_data/types.d.ts" />

// Endpoint Batch para Liberar / Ocultar Dia Inteiro na Agenda de Serviços
// Evita estourar rate limit (429) consolidando a criação/atualização de todos os horários do dia
// em uma única requisição no servidor.

routerAdd(
  'POST',
  '/backend/v1/schedules/toggle-day',
  (c) => {
    try {
      const authUser = c.auth
      if (!authUser) {
        return c.json(401, { success: false, message: 'Autenticação necessária.' })
      }

      const body = c.requestInfo().body || {}
      const dateStr = (body.date || '').trim()
      const dayName = (body.day_name || '').trim()
      const liberadoState = Boolean(body.dia_liberado)
      const slots = body.slots || []

      if (!dateStr || !dayName) {
        return c.json(400, { success: false, message: 'Data e dia da semana são obrigatórios.' })
      }

      // Profissional só pode alterar a sua própria agenda (ou admin)
      const isProf = authUser.getString('role') === 'profissional'
      const isAdmin = authUser.getString('role') === 'admin'
      if (!isProf && !isAdmin) {
        return c.json(403, {
          success: false,
          message: 'Apenas profissionais podem alterar agenda.',
        })
      }

      const profId = authUser.id

      // 1. Buscar registros existentes deste profissional para esta data
      const existing = $app.findRecordsByFilter(
        'weekly_schedules',
        `profissional = "${profId}" && data = "${dateStr}"`,
        'hora_inicio',
        100,
        0,
      )

      const col = $app.findCollectionByNameOrId('weekly_schedules')

      if (!existing || existing.length === 0) {
        // Criar os horários passados ou os 19 padrões
        const slotsToCreate =
          slots.length > 0
            ? slots
            : [
                { hora_inicio: '05:00', hora_fim: '06:00' },
                { hora_inicio: '06:00', hora_fim: '07:00' },
                { hora_inicio: '07:00', hora_fim: '08:00' },
                { hora_inicio: '08:00', hora_fim: '09:00' },
                { hora_inicio: '09:00', hora_fim: '10:00' },
                { hora_inicio: '10:00', hora_fim: '11:00' },
                { hora_inicio: '11:00', hora_fim: '12:00' },
                { hora_inicio: '12:00', hora_fim: '13:00' },
                { hora_inicio: '13:00', hora_fim: '14:00' },
                { hora_inicio: '14:00', hora_fim: '15:00' },
                { hora_inicio: '15:00', hora_fim: '16:00' },
                { hora_inicio: '16:00', hora_fim: '17:00' },
                { hora_inicio: '17:00', hora_fim: '18:00' },
                { hora_inicio: '18:00', hora_fim: '19:00' },
                { hora_inicio: '19:00', hora_fim: '20:00' },
                { hora_inicio: '20:00', hora_fim: '21:00' },
                { hora_inicio: '21:00', hora_fim: '22:00' },
                { hora_inicio: '22:00', hora_fim: '23:00' },
                { hora_inicio: '23:00', hora_fim: '00:00' },
              ]

        for (let i = 0; i < slotsToCreate.length; i++) {
          const slot = slotsToCreate[i]
          const rec = new Record(col)
          rec.set('profissional', profId)
          rec.set('dia_da_semana', dayName)
          rec.set('data', dateStr)
          rec.set('hora_inicio', slot.hora_inicio)
          rec.set('hora_fim', slot.hora_fim)
          rec.set('disponivel', true)
          rec.set('dia_liberado', liberadoState)
          $app.save(rec)
        }
      } else {
        // Atualizar os registros existentes de uma vez
        for (let i = 0; i < existing.length; i++) {
          const rec = existing[i]
          rec.set('dia_liberado', liberadoState)
          $app.save(rec)
        }
      }

      return c.json(200, {
        success: true,
        dia_liberado: liberadoState,
        message: liberadoState
          ? `Dia ${dayName} (${dateStr}) liberado com sucesso!`
          : `Dia ${dayName} (${dateStr}) ocultado com sucesso!`,
      })
    } catch (err) {
      console.error('Erro em schedules/toggle-day:', err)
      return c.json(500, {
        success: false,
        error: err && err.message ? err.message : 'Erro ao processar liberação do dia.',
      })
    }
  },
  $apis.requireAuth(),
)
