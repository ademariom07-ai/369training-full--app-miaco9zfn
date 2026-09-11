migrate(
  (app) => {
    // 0043: Atualizar profissionais de teste com vídeos de apresentação públicos,
    // coordenadas geográficas, video_enabled = true e approved = true para o feed do AlunoHome.
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    const demoVideos = [
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    ]

    const seedPros = [
      {
        email: 'teste.carlos@369training.com',
        name: 'TESTE Prof. Carlos Silva (Verificado)',
        specialties: ['Educação Física', 'Nutrição'],
        cref: '098765-G/SP',
        lat: -23.561684,
        lon: -46.655981,
        city: 'São Paulo',
        state: 'SP',
        rating_avg: 4.9,
        video_url: demoVideos[0],
        bio: 'Especialista em biomecânica aplicada e treinamento funcional 369. Acompanhamento focado em hipertrofia e performance máxima com acompanhamento biométrico.',
      },
      {
        email: 'teste.marina@369training.com',
        name: 'TESTE Dra. Marina Santos (Verificada)',
        specialties: ['Fisioterapia'],
        cref: 'CREFITO 3/112233-F',
        lat: -23.55052,
        lon: -46.633308,
        city: 'São Paulo',
        state: 'SP',
        rating_avg: 5.0,
        video_url: demoVideos[1],
        bio: 'Fisioterapeuta especialista em prevenção de lesões, reabilitação articular acelerada e mobilidade funcional integrada à rotina esportiva.',
      },
      {
        email: 'teste.fernando@369training.com',
        name: 'TESTE Mestre Fernando Ramos (Verificado)',
        specialties: ['Artes Marciais'],
        cref: 'CBJJ-883492',
        lat: -23.5678,
        lon: -46.6492,
        city: 'São Paulo',
        state: 'SP',
        rating_avg: 4.8,
        video_url: demoVideos[2],
        bio: 'Faixa preta de Jiu-Jitsu e treinador de defesa pessoal com mais de 15 anos de tatame. Foco em disciplina, autoconfiança e condicionamento cardiovascular.',
      },
      {
        email: 'teste.patricia@369training.com',
        name: 'TESTE Dra. Patrícia Lima (Verificada)',
        specialties: ['Nutrição'],
        cref: 'CRN-3 44556',
        lat: -23.5874,
        lon: -46.6812,
        city: 'São Paulo',
        state: 'SP',
        rating_avg: 4.95,
        video_url: demoVideos[3],
        bio: 'Nutricionista clínica e esportiva. Cardápios individualizados, reeducação metabólica e planos para recomposição corporal e longevidade.',
      },
      {
        email: 'teste.lucas.coach@369training.com',
        name: 'TESTE Prof. Lucas Andrade (Verificado)',
        specialties: ['Educação Física'],
        cref: '075432-G/SP',
        lat: -23.5412,
        lon: -46.6214,
        city: 'São Paulo',
        state: 'SP',
        rating_avg: 4.75,
        video_url: demoVideos[4],
        bio: 'Preparador físico de corredores e triatletas. Protocolos de endurance, controle de VO2 máx e periodização científica para provas e alta resistência.',
      },
      {
        email: 'teste.beatriz.psi@369training.com',
        name: 'TESTE Dra. Beatriz Mendes (Verificada)',
        specialties: ['Psicologia'],
        cref: 'CRP 06/154321',
        lat: -23.5721,
        lon: -46.6433,
        city: 'São Paulo',
        state: 'SP',
        rating_avg: 5.0,
        video_url: demoVideos[5],
        bio: 'Psicóloga do esporte e foco cognitivo. Treinamento mental para consistência em treinos, gestão de estresse, sono reparador e superação de metas.',
      },
    ]

    for (const pro of seedPros) {
      try {
        let rec = null
        try {
          rec = app.findAuthRecordByEmail('_pb_users_auth_', pro.email)
        } catch (_) {}

        if (!rec) {
          rec = new Record(usersCol)
          rec.setEmail(pro.email)
          rec.setPassword('Skip@Pass')
          rec.setVerified(true)
        }

        rec.set('name', pro.name)
        rec.set('role', 'profissional')
        rec.set('plan', 'pro')
        rec.set('plan_type', 'profissional')
        rec.set('approved', true)
        rec.set('video_enabled', true)
        rec.set('video_url', pro.video_url)
        rec.set('cref', pro.cref)
        rec.set('latitude', pro.lat)
        rec.set('longitude', pro.lon)
        rec.set('city', pro.city)
        rec.set('state', pro.state)
        rec.set('specialties', pro.specialties)
        rec.set('rating_avg', pro.rating_avg)
        rec.set('bio', pro.bio)

        app.save(rec)

        // Assegurar credencial verificada
        try {
          const credsCol = app.findCollectionByNameOrId('credential_verifications')
          let credRec = null
          try {
            credRec = app.findFirstRecordByData('credential_verifications', 'professional', rec.id)
          } catch (_) {}

          if (!credRec) {
            credRec = new Record(credsCol)
            credRec.set('professional', rec.id)
          }

          credRec.set('registration_number', pro.cref)
          credRec.set('status', 'verificado')
          credRec.set(
            'document_url_fallback',
            'https://img.usecurling.com/p/800/600?q=credentials+verified+gold',
          )
          credRec.set('review_notes', 'Credencial auditada e aprovada para exibição de vídeo.')
          app.save(credRec)
        } catch (credErr) {
          console.log('Erro ao atualizar credencial:', credErr)
        }
      } catch (err) {
        console.log('Erro ao semear profissional de teste com vídeo:', err)
      }
    }
  },
  (app) => {
    // down
  },
)
