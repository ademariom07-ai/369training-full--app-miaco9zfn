routerAdd(
  'POST',
  '/backend/v1/professional/submit-credential',
  (c) => {
    const auth = c.get('authRecord')
    if (!auth) {
      return c.json(401, { error: 'Não autorizado.' })
    }

    try {
      const col = $app.findCollectionByNameOrId('credential_verifications')
      const rec = new Record(col)

      const form = c.requestInfo().body || {}
      const council = form.council || 'CREF'
      const registrationNumber = form.registration_number || ''
      const status = form.status || 'pendente'

      rec.set('professional', auth.id)
      rec.set('council', council)
      rec.set('registration_number', registrationNumber)
      rec.set('status', status)

      // Se houver arquivo anexado
      const files = c.uploadedFiles()
      if (files && files['document_file'] && files['document_file'].length > 0) {
        rec.set('document_file', files['document_file'][0])
      }

      $app.save(rec)

      return c.json(200, {
        success: true,
        record: rec,
      })
    } catch (err) {
      return c.json(400, {
        error: 'Falha ao salvar credencial profissional.',
        details: String(err),
      })
    }
  },
  $apis.requireAuth(),
)
