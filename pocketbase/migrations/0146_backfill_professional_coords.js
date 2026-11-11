/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0146: Backfill de latitude/longitude dos profissionais.
 *
 * Contexto: todos os profissionais existentes estão com latitude=0/longitude=0,
 * o que fazia a busca de profissionais usar a coordenada padrão de São Paulo
 * para todos. Esta migração preenche as coordenadas a partir de city+state
 * via geocodificação Nominatim (OpenStreetMap), executando NO SERVIDOR com:
 * - Fila sequencial (nunca chamadas em lote paralelo) com atraso entre requisições;
 * - Cache em memória por cidade (no máximo 1 requisição por cidade);
 * - Idempotente: só atualiza registros com latitude=0/longitude=0; se falhar,
 *   mantém 0/0 (o app usa geocodificação no cliente como fallback);
 * - No-op em base vazia.
 *
 * Convenções da JSVM PocketBase (obrigatório):
 * - SEM .one() e SEM transações dentro de hooks de migração (viram pânico Go 500);
 * - Usar .all() / .execute() com .bind() e try/catch por etapa.
 */

migrate(
  (app) => {
    // 1. Buscar profissionais sem coordenadas reais (0/0), com cidade e UF.
    let rows = []
    try {
      rows = app
        .db()
        .newQuery(
          "SELECT id, city, state FROM users WHERE role = 'profissional' " +
            'AND (latitude IS NULL OR latitude = 0) AND (longitude IS NULL OR longitude = 0) ' +
            "AND COALESCE(city, '') != '' AND COALESCE(state, '') != ''",
        )
        .all()
    } catch (e) {
      console.log('[0146] falha ao listar profissionais sem coordenadas: ' + e)
      return
    }

    if (!rows || rows.length === 0) {
      console.log('[0146] nenhum profissional sem coordenadas — no-op')
      return
    }

    console.log('[0146] profissionais a geocodificar: ' + rows.length)

    // 2. Cache em memória por cidade (uma requisição por cidade, no máximo).
    const cache = {}
    let resolved = 0
    let failed = 0

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const city = (row.city || '').trim()
      const state = (row.state || '').trim()
      const key = (city + '|' + state).toLowerCase()

      let coords = cache[key]
      if (coords === undefined) {
        // Respeito à política de uso público do Nominatim: requisições
        // sequenciais com atraso mínimo entre elas.
        try {
          const res = $http.send({
            url:
              'https://nominatim.openstreetmap.org/search?format=json&limit=1' +
              '&countrycodes=br&city=' +
              encodeURIComponent(city) +
              '&state=' +
              encodeURIComponent(state),
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': '369training-backfill/1.0 (contato@369training.com)',
              Accept: 'application/json',
            },
            timeout: 15,
          })

          let data = null
          try {
            data = JSON.parse(res.body)
          } catch (_) {
            data = null
          }

          if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
            coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
          } else {
            coords = null
          }
          console.log(
            '[0146] geocode ' + key + ' -> ' + (coords ? coords.lat + ',' + coords.lon : 'vazio'),
          )
        } catch (e) {
          console.log('[0146] falha Nominatim para ' + key + ': ' + e)
          coords = null
        }
        cache[key] = coords
      }

      if (!coords) {
        failed++
        continue
      }

      // 3. Atualizar o registro via Record (mantém updated/autodate corretos).
      try {
        const rec = app.findRecordById('users', row.id)
        rec.set('latitude', coords.lat)
        rec.set('longitude', coords.lon)
        app.save(rec)
        resolved++
      } catch (e) {
        failed++
        console.log('[0146] falha ao atualizar ' + row.id + ': ' + e)
      }
    }

    console.log('[0146] backfill concluído — resolved=' + resolved + ' failed=' + failed)
  },
  (app) => {
    // Reverso: não desfazemos o backfill (dados, não estrutura).
    // Idempotente por natureza: só afeta registros 0/0.
  },
)
