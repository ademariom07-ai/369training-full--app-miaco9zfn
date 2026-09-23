routerAdd(
  'POST',
  '/backend/v1/legal/accept',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.json(401, { success: false, message: 'Autenticação necessária.' })
      }

      const info = e.requestInfo()
      const body = info.body || {}
      const documentId = (body.document_id || '').trim()
      const documentSlug = (body.document_slug || '').trim()
      const submittedVersion = Number(body.version) || 0
      const consentType = (body.consent_type || documentSlug || 'legal_terms').trim()

      if (!documentId && !documentSlug) {
        return e.json(400, {
          success: false,
          message: 'Parâmetro document_id ou document_slug é obrigatório.',
        })
      }

      // Localizar o documento em legal_documents
      let docRecord = null
      if (documentId) {
        try {
          docRecord = $app.findCollectionByNameOrId('legal_documents')
          docRecord = $app.findFirstRecordByData('legal_documents', 'id', documentId)
        } catch (_) {}
      }

      if (!docRecord && documentSlug) {
        try {
          docRecord = $app.findFirstRecordByData('legal_documents', 'slug', documentSlug)
        } catch (_) {}
      }

      if (!docRecord) {
        return e.json(404, {
          success: false,
          message: 'Documento legal não encontrado.',
        })
      }

      const docStatus = docRecord.getString('status')
      if (docStatus !== 'publicado') {
        return e.json(400, {
          success: false,
          message: 'O documento legal solicitado não está publicado.',
        })
      }

      const publishedVersion = Number(docRecord.get('version')) || 1
      if (submittedVersion > 0 && submittedVersion !== publishedVersion) {
        return e.json(400, {
          success: false,
          message: `Versão informada (${submittedVersion}) não corresponde à versão atualmente publicada (${publishedVersion}).`,
        })
      }

      const finalVersion = submittedVersion > 0 ? submittedVersion : publishedVersion
      const finalDocId = docRecord.id
      const finalSlug = docRecord.getString('slug') || documentSlug

      // Idempotência: verificar se já existe aceite do mesmo usuário para o mesmo document + version
      try {
        const filterStr = `user = '${authUser.id}' && (document = '${finalDocId}' || document_slug = '${finalSlug}') && version = ${finalVersion}`
        const existing = $app.findRecordsByFilter('legal_acceptances', filterStr, '-created', 1, 0)
        if (existing && existing.length > 0) {
          return e.json(200, {
            success: true,
            already_accepted: true,
            message: 'Documento já aceito anteriormente.',
            acceptance_id: existing[0].id,
          })
        }
      } catch (_) {}

      // Obter IP e user-agent
      const reqHeaders = info.headers || {}
      let userAgent = 'server-verified'
      if (reqHeaders['user-agent']) {
        userAgent = Array.isArray(reqHeaders['user-agent'])
          ? reqHeaders['user-agent'][0]
          : reqHeaders['user-agent']
      }

      const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19)

      // Criar registro em legal_acceptances
      const acceptCol = $app.findCollectionByNameOrId('legal_acceptances')
      const acceptRec = new Record(acceptCol)
      acceptRec.set('user', authUser.id)
      acceptRec.set('document', finalDocId)
      acceptRec.set('document_slug', finalSlug)
      acceptRec.set('version', finalVersion)
      acceptRec.set('accepted_at', nowIso)
      acceptRec.set('ip', 'server-verified')
      acceptRec.set('user_agent', String(userAgent || 'server-verified').slice(0, 255))
      acceptRec.set('consent_type', consentType)
      $app.save(acceptRec)

      // Registrar em audits
      try {
        const auditCol = $app.findCollectionByNameOrId('audits')
        const auditRec = new Record(auditCol)
        auditRec.set('actor', authUser.id)
        auditRec.set('target_type', 'legal_acceptances')
        auditRec.set('target_id', acceptRec.id)
        auditRec.set('action', 'LEGAL_ACCEPTED')
        auditRec.set('details', {
          document_id: finalDocId,
          document_slug: finalSlug,
          version: finalVersion,
          consent_type: consentType,
          accepted_at: nowIso,
        })
        $app.save(auditRec)
      } catch (auditErr) {
        console.warn('Erro ao salvar auditoria de aceite legal:', auditErr)
      }

      return e.json(200, {
        success: true,
        message: 'Aceite legal registrado com sucesso.',
        acceptance_id: acceptRec.id,
      })
    } catch (err) {
      console.error('Erro na rota /backend/v1/legal/accept:', err)
      return e.json(500, {
        success: false,
        error: err ? err.message : 'Erro interno ao registrar aceite.',
      })
    }
  },
  $apis.requireAuth(),
)
