routerAdd(
  'POST',
  '/backend/v1/professional/submit-credential',
  (e) => {
    const authUser = e.auth
    if (!authUser) {
      return e.json(401, { error: 'Não autorizado.' })
    }

    try {
      const col = $app.findCollectionByNameOrId('credential_verifications')
      const rec = new Record(col)

      const form = e.requestInfo().body || {}
      const council = form.council || 'CREF'
      const registrationNumber = form.registration_number || ''
      const status = form.status || 'pendente'

      rec.set('professional', authUser.id)
      rec.set('council', council)
      rec.set('registration_number', registrationNumber)
      rec.set('status', status)

      // Se houver arquivo anexado via multipart
      const files = e.findUploadedFiles('document_file') || []
      if (files.length > 0) {
        rec.set('document_file', files[0])
      }

      $app.save(rec)

      return e.json(200, {
        success: true,
        record_id: rec.id,
        record: rec,
      })
    } catch (err) {
      return e.json(400, {
        error: 'Falha ao salvar credencial profissional.',
        details: String(err),
      })
    }
  },
  $apis.requireAuth(),
)
