# IA das cinco áreas — atualização dos requisitos — 15/10/2026

Status: especificação proposta, não implementação concluída. Complementa prompts
anteriores e não os substitui. Preservar marca e três perfis da prévia integral.

## Requisitos confirmados pelo usuário nesta atualização
- Acesso na home Aluno e Profissional a treino e alimentação assistidos por IA.
- Anamnese do aluno, objetivos, frequência, idade e restrições como entradas.
- Hipertrofia, força, resistência, corrida e catálogo extensível de objetivos.
- Aluno sem vínculo usa benefícios de seu plano. Aluno vinculado herda benefícios
  do parceiro; usuário reiterou também coeficiente de pontuação do parceiro.
- Profissional gera, revisa, ajusta e entrega ao aluno, dentro de sua competência;
  preço do serviço acordado entre as partes e tarifa conforme fluxo financeiro.
- Aluno usa IA com aviso de necessidade de acompanhamento profissional.
- Cronômetro de pausas, ilustrações, vídeos YouTube e feedback para ajuste de carga.
- Cinco áreas: Educação Física, Nutrição, Fisioterapia, Psicologia, Artes Marciais.

A nova afirmação de herança pode substituir a exceção anterior para PRO PARCEIRO;
confirmar alcance antes de alterar a pontuação. Não misturar benefícios de acesso
com multiplicador financeiro. Não existe quantidade de gerações aprovada por plano
neste pedido. Não converter uma geração ou ajuste de IA em serviço cobrado/pontuado.

## Três referências oficiais, consultadas em 15/10/2026
1. ABC Trainerize: AI Workout Builder cria rascunho estruturado, revisto/editado
   e atribuído pelo treinador. É referência prioritária para fluxo B2B2C; a
   documentação não apresenta este gerador como criador de conteúdo nutricional.
   https://help.trainerize.com/hc/en-us/articles/45565151151508-Using-the-AI-Workout-Builder
2. Fitbod: objetivo, experiência, equipamentos, histórico e recuperação estimada
   orientam exercícios, séries, repetições e carga. Referência para personalização,
   não demonstração de eficácia clínica ou cobertura das cinco profissões.
   https://help.fitbod.me/hc/en-us/articles/360004429814-How-Fitbod-Creates-Your-Workout
3. Freeletics: feedback de esforço por exercício ajuda a adaptar sessões futuras.
   Referência para acompanhamento e ajuste; lesão não deve ser tratada como simples
   preferência de exercício.
   https://www.freeletics.com/en/blog/posts/what-is-the-purpose-of-the-feedback-i-am-asked-to-give-after-each-workout/

## Arquitetura recomendada
Uma infraestrutura de IA, com módulos de domínio separados e regras verificáveis:
- Anamnese versionada, objetivos, contexto e consentimentos estritamente necessários.
- Serviço de permissões por papel, profissão, vínculo, assinatura e benefícios.
- Biblioteca validada de exercícios/conteúdos com IDs, contraindicações, equipamento,
  demonstrações, acessibilidade e responsáveis pela revisão.
- Geração estruturada a partir dessa biblioteca: IA propõe; código valida campos,
  limites, escopo profissional e referências. Sem inventar vídeo, diagnóstico ou
  credenciais. Provedor e modelo substituíveis; chaves somente no servidor.
- Rascunho -> revisão -> aprovação -> publicação -> execução -> feedback.
  Alteração após aprovação gera nova versão e nova revisão quando necessária.
- Falha do provedor gera indisponibilidade ou rascunho identificado; nunca um plano
  genérico apresentado como prescrição individual validada.
- Registro da versão da anamnese, política, modelo, catálogo e revisor; não copiar
  dados de saúde desnecessários para logs, prompts de outros alunos ou analytics.
- Plano aprovado continua acessível se IA indisponível; sem inventar nova prescrição.

## Jornadas
Aluno: home -> Meu objetivo/anamnese -> consentimentos e triagem -> plano vigente
ou proposta de IA -> acompanhamento profissional quando indicado -> executar com
pausas, mídia e registro -> feedback de esforço, dor e técnica -> ajuste proposto.
Aluno vinculado não recebe alteração silenciosa do plano já aprovado pelo parceiro.

Profissional: home -> escolher aluno autorizado -> conferir anamnese atual ->
definir área/objetivo/frequência/duração/equipamento/restrições -> gerar rascunho ->
revisar cada item -> aprovar versão identificada -> enviar -> acompanhar adesão.
O profissional só recebe dados autorizados e necessários à sua atuação. Vínculo
não libera automaticamente o prontuário de Psicologia para outros profissionais.

## Escopo proposto por área
| Área | Aluno diretamente | Profissional |
| Educação Física | Orientação de atividade/execução compatível com triagem | Rascunho de treino, periodização e revisão de progressão |
| Nutrição | Educação alimentar, hábitos e registro; sem dieta clínica automática | Rascunho alimentar individualizado para revisão do nutricionista |
| Fisioterapia | Executar programa liberado e registrar sintomas | Rascunho de exercícios terapêuticos após avaliação do fisioterapeuta |
| Psicologia | Psicoeducação, hábitos e encaminhamento; sem diagnóstico/psicoterapia por chatbot | Apoio à organização de materiais, sem decisão clínica autônoma |
| Artes Marciais | Condicionamento e fundamentos conforme nível; sem técnicas perigosas autônomas | Sessões por modalidade, graduação, equipamentos e supervisão |

Competência precisa ser verificada; cadastro genérico de profissional não permite
prescrever em todas as áreas. Um termo não transfere toda responsabilidade da
plataforma nem dispensa limites técnicos e revisão pertinente. Escopo jurídico e
profissional requer validação específica antes da operação.

## Anamnese e execução
Campos comuns: idade/faixa etária, objetivo, experiência, tempo por sessão,
frequência, equipamentos, limitações e avaliação profissional prévia quando houver.
Campos de saúde somente conforme finalidade: sintomas/dor, lesões, condições,
medicação relevante, gestação/pós-parto e necessidades específicas. Não presumir
que dado não preenchido significa ausência de restrição. Menopausa/ciclo opcionais
com acesso restrito; manter requisitos prévios de 40+, hidratação e encaminhamento.
Nutrição inclui alergias, preferências, rotina e contexto, sem calorias fixas padrão.
Menores e populações especiais precisam de fluxos e aprovação definidos antes da
liberação; proposta inicial é adultos, com revisão reforçada para situações de risco.

Pausas: iniciar/pausar/retomar, aviso sonoro opcional, manter estado ao trocar tela.
Feedback: esforço, repetições reais, técnica, dor e fadiga. Sem incremento fixo
universal de kg. Ajustes respeitam catálogo/equipamento e aprovação do profissional.
Dor ou sinal de alerta interrompe progressão e encaminha para avaliação adequada.
Corrida usa duração/distância/intensidade; não reutilizar modelo de carga em kg.
YouTube: IDs curados, player oficial, verificação de disponibilidade/incorporação;
se vídeo cair, mostrar alternativa aprovada, sem baixar/republicar conteúdo alheio.
Ilustrações anatomicamente revisadas e licenciadas, não imagem gerada sem conferência.
https://developers.google.com/youtube/player_parameters

## Evidências de lacunas atuais no código
- CriacaoTreino.tsx envia experience='Avançado', daysAvailable=5 e restrictions='Nenhuma'.
- ai_generate_diet.js tem defaults de calorias/macros e fallback genérico.
- ai_load_feedback.js sugere incremento fixo por dificuldade, sem gate de dor/técnica.
- aluno_agent_copilot.js tem templates e quotas antigas; não são nova tabela aprovada.
- Integração real das cinco áreas, permissões e aprovação da versão não homologada.

## Financeiro e planos
Geração de IA é uso do produto, não prova de serviço concluído. Serviço profissional
cobra conforme preço aceito, pagamento confirmado e avaliação mútua. Profissional
Grátis/Básico/Pro/Premium: 0/1/2/3 reais por serviço validado; PRO PARCEIRO 149/mês,
sem tarifa por atendimento. Não multiplicar tarifa por exercício, vídeo ou tentativa.
Mensalidades pendentes não desbloqueiam plano. Benefícios herdados consultados no
servidor; não aceitar plano/autorização informados pelo navegador. Revisão profissional
não implica disponibilidade ilimitada incluída no plano de assinatura.

## Entrega em etapas e aceite
1. Anamnese, direitos de acesso e revisão: testar falta de dado, vínculo, revogação,
   acesso cruzado, anamnese alterada e publicação por profissão não autorizada.
2. Home aluno/profissional e treino: catálogo validado, duração e pausas coerentes,
   execução e feedback; sem cobrança/pontuação por geração.
3. Nutrição e encaminhamento: separar educação de plano revisado, alergias e consentimento.
4. Fisioterapia/Psicologia/Artes Marciais: protocolos específicos aprovados por área.
5. Wearables, progressão e vídeos: validação de unidades, dados ausentes, retomada,
   vídeo removido e comportamento quando modelo indisponível.

Não liberar “todos os objetivos” sem catálogo e testes por modalidade. Priorizar
objetivos já pedidos, acrescentando emagrecimento/condicionamento/mobilidade conforme
aprovação. Não prometer diagnóstico, correção biomecânica por câmera ou resultado.

## Perguntas para decisão
- Confirmar benefícios de IA herdados também no PRO PARCEIRO e se a pontuação passa
  igualmente a herdar peso 2, substituindo a exceção anterior do plano próprio.
- Aprovar proposta de revisão profissional antes de dietas individualizadas,
  reabilitação e programas em situações de risco; definir atendimento a menores.
- Definir limites de gerações por plano; preservar sempre acesso ao plano já recebido.

Referências adicionais de orientação e privacidade:
https://site.cfp.org.br/publicacao/inteligencia-artificial-na-psicologia-guia-para-uma-pratica-etica-e-responsavel/
https://www.gov.br/anpd/pt-br/documentos-e-publicacoes/glossario-anpd

## Decisões recebidas e preparação técnica — 15/10/2026, atualização

Esta seção prevalece sobre as perguntas anteriores:
- Aluno vinculado escolhe manter coeficiente próprio ou migrar para o do parceiro.
  Benefícios de IA herdados são separados desta escolha. Plano próprio preservado.
- PRO PARCEIRO: peso 2 confirmado em 13/10 e presente em wellnessCommercialRules;
  hooks antigos com peso 1 permanecem divergentes, não uma nova decisão. Migração
  do aluno herda coeficiente 2, NUNCA os 150 serviços fixos do profissional.
- Revisão profissional aprovada para dieta individualizada, reabilitação e risco.
- Menores incluídos no escopo mediante adequação à legislação, sem liberação imediata.
- Limites confirmados para aluno e profissional: Grátis 2, Básico 5, Pro 10,
  Premium ilimitado; configuráveis no administrativo. Quota de PRO PARCEIRO,
  periodicidade e unidade de consulta não foram especificadas: não inventar.

Novo módulo aiAccessPolicy.ts prepara validação de configuração, consulta de saldo
por plano, preservação do acesso a planos previamente autorizados, escolha de
coeficiente e encaminhamento de menores/revisão. O contador deve vir do servidor;
ainda faltam persistência, reserva atômica de quota, UI administrativa, seleção
no vínculo e conexão aos endpoints de IA. O helper não concede acesso a documentos
antes não autorizados e não cobra excedentes. Nenhuma quota nova está ativa no app.
8 testes locais passaram; TypeScript sem erros. Não houve teste clínico/jurídico,
chamada de IA real, migração ou publicação.

Requisitos legais pesquisados em fontes oficiais:
https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15211.htm
https://www.gov.br/mj/pt-br/assuntos/sua-protecao/sedigi/eca-digital/eca-digital-1

Implementação a homologar: melhor interesse; minimização de dados; base legal
por finalidade (incluindo dados sensíveis); informação acessível por idade;
verificação etária proporcional; vínculo e autorização de responsável quando
aplicáveis; privacidade por padrão; revisão do profissional e fluxo de denúncia.
Não tratar um checkbox como comprovação de autorização nem entregar a todos os
parceiros acesso ao prontuário. Consentimento não é a única hipótese legal possível;
definir cada hipótese e o fluxo profissional com assessoria competente. O controle
minorFlowVerified é contrato de servidor, não declaração que o navegador pode
fornecer como prova. Não afirmar conformidade integral apenas com estes helpers.

Proposta para confirmação: contar uma geração concluída de treino ou alimentação
como consulta, em quota mensal compartilhada, sem descontar erro, retry, leitura
ou revisão do profissional. Ainda não aprovada. Premium ilimitado não remove
limites técnicos de concorrência/abuso ou segurança clínica.

## Formulário profissional — continuação

CriacaoTreino agora solicita objetivo, experiência, frequência, idade, equipamentos
 e restrições; retirados os parâmetros fixos Avançado/5 dias/Nenhuma e as cargas
pré-preenchidas de exemplo. Geração identificada como rascunho; confirmação de
revisão exigida na tela antes de enviar plano gerado, ai_generated preservado.
Troca de aluno limpa contexto e descarta resultado antigo; alteração dos campos
invalida resultado em voo e confirmação de revisão. Edição de exercício exige
nova revisão. Geração de menores bloqueada nesta tela até fluxo verificado.

13 testes de helpers passaram; TypeScript sem erros. Sem testes de navegador ou
chamada real da IA. Isto NÃO implementa a aprovação clínica no servidor: endpoint
legado continua exigindo migração, autorização por profissão, anamnese versionada,
verificação etária, validação do resultado e trilha de aprovação persistente.
Quotas/período/PRO PARCEIRO continuam sem ativação automática. O HTML independente
não foi atualizado nesta etapa; mudanças são da tela React na branch.

### Continuação: contrato do gerador de treinos no servidor

- Endpoint exige objetivo, experiência reconhecida, dias inteiros de 1 a 7 e restrições explícitas; limita tamanho das entradas antes de chamar IA.
- JSON inválido, exercícios ausentes ou campos incompletos agora resultam em erro 502, sem criar treino genérico de substituição. Falha do provedor retorna 503 sem detalhes internos.
- Resposta validada por lista explícita de campos, limites de tamanho e quantidade; IDs e estado de conclusão definidos pelo servidor. Links sugeridos pelo modelo são descartados até existir catálogo de vídeos verificados.
- Testes locais: 15 cenários do endpoint em VM, mais 13 de política de acesso e formulário. Isso valida contrato, não qualidade clínica nem execução em PocketBase real.
- Pendências: aluno ainda persiste resultado como ativo; revisão/autorização profissional, anamnese estruturada no servidor, cotas e fluxo de menores precisam ser integrados antes de operação real. A validação estrutural não resolve essas autorizações. Prévia HTML não alterada nesta etapa.

### Continuação: rascunho do aluno separado do treino ativo

- MonteSeuTreino deixa de criar registro ativo ao receber resposta da IA. Mostra proposta temporária separada do treino atual, sem conclusão, ajuste de carga ou pontuação; informa que não persiste e que envio/revisão ainda estão em preparação.
- Reutiliza validação de idade, equipamentos e conferência da anamnese; remove a ausência de lesões presumida e corrige os valores de experiência enviados ao endpoint. Alterar dados invalida a conferência e descarta respostas antigas.
- Validação: 28 testes existentes de contrato/política/formulário passaram; TypeScript do aplicativo verificado com tsconfig.app.json. Sem teste de navegador nem integração real nesta etapa.
- Limite: contenção na interface, não autorização de banco. Regras de escrita/leitura da coleção, revisão autenticada e registro persistente de aprovação ainda precisam de implementação e testes integrados. Registros legados não foram alterados; prévia HTML anterior permanece inalterada.

### Continuação: isolamento dos registros de treino (migração 0066 preparada)

- O esquema versionado de workouts ainda permitia operações por qualquer autenticado. Preparada migração 0066 para listagem/leitura/edição apenas do aluno dono, profissional responsável ou administrativo; criação por profissional aprovado identificando-se como responsável (aluno destino deve ter role aluno), ou administrativo; exclusão pelo profissional responsável aprovado ou administrativo.
- Atualizações comuns não podem enviar student/professional, inclusive administrativas. Reatribuição requer fluxo separado auditável. Reversão restringe leitura ao administrativo e bloqueia escritas comuns, sem restaurar exposição.
- Exportação do esquema alinhada. Oito testes de contrato da migração em VM passaram, totalizando 36 com contrato de IA e políticas/formulário. Os testes usam tradução simplificada das regras: não substituem parser, HTTP, relações, realtime, superusuário e concorrência em PocketBase real.
- NÃO executada em banco ou publicada. Validar em staging antes de aplicar; alunos deixam de poder criar diretamente registros workouts. Registros anteriores não foram alterados.
- Não é aprovação clínica: estudante dono ainda pode editar conteúdo do próprio treino pelas regras; profissional ainda precisa comprovar relação de atendimento/consentimento para criar para um aluno, e o campo approved não prova habilitação profissional. Próximos controles: separar progresso da prescrição, revisão autenticada com histórico e autorização por área, e escopo da lista de alunos no formulário profissional. APIs internas com acesso privilegiado precisam de autorização própria.
- Referências técnicas: https://pocketbase.io/docs/api-rules-and-filters/ e https://pocketbase.io/docs/js-event-hooks/ (consultadas em 15/10/2026).

### Continuação: progresso pessoal sem alterar prescrição nem gerar serviço

- Novo POST /backend/v1/workouts/progress: autentica aluno dono, carrega o treino em transação e aceita somente conclusão booleana de exercício por ID ou finalização. Rejeita campos extras, treinos arquivados, IDs ambíguos e finalização incompleta. Finalizações repetidas não escrevem novamente. Não cria serviços, cobranças ou pontos.
- Tela do aluno usa esse endpoint; deixa de substituir a carga prescrita pelo feedback da IA e de criar serviço concluído ao finalizar. Textos de pontuação automática removidos; feedback é explicitamente temporário e não persistido.
- Revisada a migração 0066 ainda NÃO aplicada: edição direta de workouts passa a ser exclusiva do profissional responsável aprovado ou administrativo. Aluno continua lendo, mas registra progresso pelo endpoint restrito. Endpoint, cliente e migração precisam ser entregues juntos em staging; sem aplicar a migração, a API genérica antiga continua sendo uma lacuna.
- Nove testes novos do endpoint em VM; total 45 testes locais passaram. TypeScript do aplicativo passou. Transação e regras precisam de testes HTTP reais, incluindo concorrência, antes de produção; simulação não comprova esses aspectos.
- Limites: campo completed permanece no JSON legado, não há histórico por sessão nem armazenamento separado de feedback; aprovação clínica e habilitação por área ainda não estão comprovadas. Demais caminhos de criação de services precisam de auditoria própria. Nenhum registro real foi migrado, nenhum app foi publicado e a prévia HTML anterior não mudou.

### Continuação: anamnese estruturada no endpoint de treino

- Idade, equipamentos e confirmação de conferência passam a campos explícitos do contrato, enviados pelos formulários Aluno e Profissional pelo construtor compartilhado. Idade não fica apenas no texto das observações.
- Servidor exige idade inteira 0–120, equipamento não vazio até 500 caracteres e conferência exatamente booleana true. Idades informadas abaixo de 18 retornam 409 antes da chamada ao provedor; texto livre alegando autorização não remove o bloqueio. Sem dados obrigatórios, retorna 400 antes da IA.
- Isso NÃO verifica idade real, responsável, consentimento ou habilitação profissional. A confirmação do formulário é só conferência dos dados. Menores continuam aguardando fluxo próprio, sem conclusão de conformidade jurídica.
- Testes locais: 57 passaram no conjunto IA/formulário/progresso/permissões, incluindo 12 novos casos de dados estruturados e bloqueio de menores. TypeScript do aplicativo passou. Não houve chamada real à IA, teste clínico, migração ou publicação; cliente e servidor devem ser entregues juntos porque o contrato agora rejeita chamadas antigas sem esses campos.
- Pendências mantidas: autorização profissional por área, revisão persistida, cotas atômicas, consentimento/versionamento da anamnese, vídeos curados e verificação integrada. Prévia HTML anterior não atualizada nesta etapa.

### Continuação: feedback de carga para revisão, sem progressão automática

- Removidos os aumentos fixos de 1/2 kg usados como fallback e o preenchimento presumido de 20 kg na tela. Carga real é informada; zero é preservado, assim como esforço zero.
- Endpoint exige campos tipados, objetivo/séries/repetições e respostas booleanas sobre dor e dificuldade técnica. Resposta positiva retorna 409 antes da IA, orientando revisão profissional. São autorrelatos, sem conclusão clínica.
- IA passa a organizar relato para revisão; campos de carga/repetições e ação retornados pelo modelo são descartados. Servidor define action=review, requiresProfessionalReview=true e carga/repetições a definir pelo profissional. Textos livres gerados ainda precisam de revisão, pois validação estrutural não garante conteúdo clínico correto.
- Resposta inválida retorna 502 sem fallback, falha do provedor 503 sem detalhes internos. Tela identifica análise provisória; resposta em trânsito é descartada se contexto/modal mudar. Nenhum ajuste de carga é salvo.
- 73 testes locais passaram, incluindo 16 novos de feedback; TypeScript do aplicativo passou. Sem validação clínica, chamada real de IA ou teste de navegador. Contratos de cliente e servidor precisam ser entregues juntos.
- Recurso de ajuste efetivo de carga permanece pendente de revisão autenticada, contexto completo e registro profissional; limites por plano/herança e persistência de feedback ainda precisam integração. Prévia HTML anterior permanece inalterada.

### Continuação: cronômetro de descanso do aluno

- Componente RestTimer adicionado à tela MonteSeuTreino, disponível em registros de status ativo; rascunhos da IA não recebem controles de execução. Um exercício por vez seleciona o cronômetro.
- Iniciar/continuar, pausar e reiniciar; aviso visual ao término. Contagem por horário de término, recalculada ao retornar à aba, sem depender da quantidade de ticks. Não persiste dados nem altera prescrição, conclusão, serviços, tarifas ou pontos.
- Reconhece apenas durações inequívocas em segundos, minutos ou mm:ss (1–3600 segundos). Texto livre, intervalos e ausência de unidade não geram duração presumida; usuário deve informar segundos conforme orientação. Trocar treino/exercício ou sair da tela descarta contagem. Não há notificação em segundo plano, som ou garantia de alerta com app fechado.
- 15 testes de interpretação de duração passaram, incluindo valores ambíguos/inválidos; TypeScript do aplicativo passou. Pausa, retomada, fim, mudança de aba e acessibilidade ainda precisam de verificação no navegador. Alteração salva no código React, sem publicação; prévia HTML antiga não incorpora o cronômetro.
