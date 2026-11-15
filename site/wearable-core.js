'use strict';
const WearableCore=(()=>{
function validMetricDate(value         )                  {
 if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
 const d = new Date(value + 'T12:00:00Z')
 return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value
}
function metricNumber(value         , integer = false)                {
 return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10000000 && (!integer || Number.isInteger(value)) ? value : null
}
function metricProjection(raw                         ) {
 return { date: validMetricDate(raw.date) ? raw.date : null, steps: metricNumber(raw.steps, true), heart_rate_avg: metricNumber(raw.heart_rate_avg), distance_meters: metricNumber(raw.distance_meters), workouts_count: metricNumber(raw.workouts_count, true) }
}
function parseDemoMetric(raw                         , today        ) {
 if (!validMetricDate(raw.date) || !validMetricDate(today) || raw.date > today) throw new Error('Informe uma data válida até hoje.')
 const result                          = { date: raw.date }
 for (const key of ['steps', 'heart_rate_avg', 'distance_meters', 'workouts_count']) {
  const value = raw[key]
  if (value === '' || value === undefined || value === null) { result[key] = null; continue }
  if (typeof value !== 'string' || !/^\d+(\.\d{1,2})?$/.test(value)) throw new Error('Use números positivos com até duas casas decimais.')
  const n = metricNumber(Number(value), key === 'steps' || key === 'workouts_count')
  if (n === null) throw new Error('Revise os números do registro.')
  result[key] = n
 }
 if (Object.entries(result).filter(([k]) => k !== 'date').every(([,v]) => v === null)) throw new Error('Preencha pelo menos um campo.')
 return metricProjection(result)
}

return Object.freeze({validMetricDate,metricNumber,metricProjection,parseDemoMetric});
})();
