# Revisão antes de publicar treinos — 24/10/2026

O formulário do profissional agora prepara uma prévia com nome do aluno, título e orientações. A publicação ocorre somente pelo botão de confirmação dessa prévia. Alteração do aluno, conteúdo, profissional, versão/estado do vínculo ou nome invalida a confirmação no cliente. A RPC existente continua responsável pela autorização no servidor e idempotência. Não foi criado atestado legal, prontuário, assinatura nem auditoria clínica de revisão.

Validação: 37 testes em trainingReview, trainingHistory, trainingPlans e trainingCompletions passaram; TypeScript com `tsc --noEmit -p tsconfig.app.json` passou; build de acesso passou com 117 módulos (aviso de bundle maior que 500 kB). O build inicial encontrou erro JSX durante edição, corrigido antes do build final e publicação.

Não houve migração, vínculo entre contas reais, prescrição real, chamada de IA ou cobrança neste ciclo. Homologação de navegador autenticado continua pendente; a sessão anterior não foi concluída. Revisão obrigatória no servidor para a futura geração de IA não está implementada por esta alteração de UX.
