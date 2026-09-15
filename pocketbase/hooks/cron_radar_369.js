// Cron job semanal: Radar 369 — Briefing de Evidências Científicas e Tendências
// Roda todo domingo à noite (23:00) gerando briefing para as especialidades parceiras
cronAdd('radar_369_weekly', '0 23 * * 0', () => {
  const now = new Date()
  const year = now.getFullYear()
  // Identificador do ciclo semanal YYYY-MM-Wn
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const weekNumber = Math.ceil(now.getDate() / 7)
  const cycle = `${year}-${month}-W${weekNumber}`
  const nowIsoPb = now.toISOString().replace('T', ' ').slice(0, 19)

  const specialties = [
    'Educação Física',
    'Nutrição',
    'Fisioterapia',
    'Artes Marciais',
    'Psicologia',
  ]

  const radarCol = $app.findCollectionByNameOrId('radar_briefings')

  const scientificEvidenceCatalog = {
    'Educação Física': [
      {
        title: '[TESTE] Volume Semanal por Grupo Muscular e Síntese Hipertrófica',
        evidence_level: 'Evidência Forte (Metanálise)',
        source_name: 'Journal of Strength and Conditioning Research',
        source_url: 'https://doi.org/10.1519/JSC.0000000000004500',
        summary:
          '[TESTE] Faixa de 12 a 20 séries semanais por grupamento muscular promove hipertrofia ótima em atletas treinados.',
        council_update: 'CONFEF: recomendação de documentação digital de cargas progressivas.',
        content_suggestion:
          'Infográfico: "Como periodizar volume semanal sem atingir overreaching".',
      },
      {
        title:
          '[TESTE] Treinamento Intervalado de Alta Intensidade (HIIT) e Biogênese Mitocondrial',
        evidence_level: 'Evidência Forte (Ensaio Clínico)',
        source_name: 'Medicine & Science in Sports & Exercise',
        source_url: 'https://doi.org/10.1249/MSS.0000000000003000',
        summary:
          '[TESTE] Protocolos curtos de 4x4 min a 90% FCmax apresentaram elevação similar de VO2max com 40% menor volume de treino.',
        council_update: 'Diretrizes sobre teste ergométrico prévio em cardiopatas.',
        content_suggestion:
          'Dica rápida em vídeo: "3 protocolos de HIIT validados para queima calórica eficiente".',
      },
    ],
    Nutrição: [
      {
        title: '[TESTE] Distribuição Equitativa de Proteína vs. Bolus Único',
        evidence_level: 'Evidência Forte (Revisão Sistemática)',
        source_name: 'Nutrients Journal',
        source_url: 'https://doi.org/10.3390/nu15000000',
        summary:
          '[TESTE] Fracionar 0,40g/kg de proteína de alto valor biológico a cada 3-4 horas otimiza a sinalização mTORC1 contínua.',
        council_update:
          'CFN: boas práticas na prescrição de planos hiperproteicos em atletas amadores.',
        content_suggestion:
          'Story interativo: "Quantas gramas de proteína seu corpo absorve por refeição?".',
      },
      {
        title: '[TESTE] Suplementação de Beta-Alanina e Buffer Intracelular',
        evidence_level: 'Evidência Moderada (Estudo Clínico)',
        source_name: 'Frontiers in Nutrition',
        source_url: 'https://doi.org/10.3389/fnut.2026.00112',
        summary:
          '[TESTE] Saturação de carnosina intramuscular melhora capacidade de sustentação em esforços de 1 a 4 minutos.',
        council_update: 'Atualização sobre laudos analíticos e pureza da matéria-prima.',
        content_suggestion: 'Checklist de pré-treino com respaldo de evidência.',
      },
    ],
    Fisioterapia: [
      {
        title: '[TESTE] Exercício Terapêutico Ativo vs. Eletroterapia Passiva em Lombalgias',
        evidence_level: 'Evidência Forte (Diretriz Internacional)',
        source_name: 'Annals of Physical and Rehabilitation Medicine',
        source_url: 'https://doi.org/10.1016/j.rehab.2026.101700',
        summary:
          '[TESTE] Fortalecimento do core e controle motor possuem eficácia 3x superior a terapias puramente passivas em longo prazo.',
        council_update: 'CREFITO: foco em educação do paciente e autonomia funcional.',
        content_suggestion:
          'Post carrossel: "Por que repouso absoluto piora a dor lombar mecânica".',
      },
    ],
    'Artes Marciais': [
      {
        title: '[TESTE] Monitoramento de Concussões Subclínicas e Tempo de Reação',
        evidence_level: 'Evidência Forte (Consenso Internacional)',
        source_name: 'British Journal of Sports Medicine',
        source_url: 'https://doi.org/10.1136/bjsports-2026-concussion',
        summary:
          '[TESTE] Protocolo SCAT6 e pausas preventivas diminuem risco cumulativo neurológico em esportes de combate.',
        council_update: 'Norma da Confederação de MMA/Judô/BJJ para retorno seguro ao tatame.',
        content_suggestion:
          'Guia de prevenção: "Sinais de concussão no tatame que nunca devem ser ignorados".',
      },
    ],
    Psicologia: [
      {
        title: '[TESTE] Aderência ao Exercício através da Teoria da Autodeterminação',
        evidence_level: 'Evidência Forte (Metanálise)',
        source_name: 'Psychology of Sport and Exercise',
        source_url: 'https://doi.org/10.1016/j.psychsport.2026.102000',
        summary:
          '[TESTE] Motivação intrínseca ancorada em competência e autonomia prediz continuidade por mais de 24 meses.',
        council_update: 'CRP: resolução sobre psicologia desportiva e sigilo do prontuário.',
        content_suggestion:
          'Vídeo: "Como transformar força de vontade temporária em disciplina sustentável".',
      },
    ],
  }

  for (const spec of specialties) {
    try {
      const existing = $app.findRecordsByFilter(
        'radar_briefings',
        `specialty = '${spec}' && cycle = '${cycle}'`,
        '-created',
        1,
        0,
      )
      if (existing && existing.length > 0) continue
    } catch (_) {}

    const items = scientificEvidenceCatalog[spec] || scientificEvidenceCatalog['Educação Física']

    const rec = new Record(radarCol)
    rec.set('specialty', spec)
    rec.set('cycle', cycle)
    rec.set('items', items)
    rec.set('published_at', nowIsoPb)
    rec.set('is_mock', true)
    $app.save(rec)
  }

  console.log(`[Radar 369] Cron semanal finalizado com sucesso para o ciclo ${cycle}.`)
})
