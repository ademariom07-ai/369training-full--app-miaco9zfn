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
