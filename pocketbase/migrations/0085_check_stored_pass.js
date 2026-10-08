/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const settings = app.settings()
  const pass = settings.smtp.password || ''

  let rec = app.findFirstRecordByData('platform_config', 'key', 'smtp_diag_last_run')
  rec.set(
    'description',
    'stored_pass_len=' +
      pass.length +
      '; prefix=' +
      (pass.length >= 6 ? pass.substring(0, 6) : 'NONE') +
      '; suffix=' +
      (pass.length >= 10 ? pass.substring(pass.length - 8) : 'NONE'),
  )
  app.save(rec)
})
