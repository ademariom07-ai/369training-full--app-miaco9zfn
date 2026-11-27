# 369 WELLNESS — estado do projeto (para retomar a conversa)

Atualizado em 24/11/2026. Branch publicado: `prep/supabase-vite` → https://369wellness.app (também em https://369wellness.ademariom07.workers.dev)
Registro das mudanças no banco e no painel: `docs/aplicacoes-banco.md`.

## Pronto e publicado
- Endereço oficial: https://369wellness.app (o antigo 369wellness.ademariom07.workers.dev continua funcionando).
- Home individual por perfil (aluno, parceiro, admin) com "Seu caminho", "Como funciona" e ajuda (?) em cada tela.
- Pilares: Foco, Disciplina e Estratégia (site e app).
- Cadastro rápido, login com Google, recuperação de senha por código de 6 dígitos (e-mail via Brevo).
- App instalável (PWA) e cabeçalhos de segurança.
- Feed de vídeos (YouTube) por proximidade, com aprovação do admin.
- Fase 2: vitrine do profissional, busca por modalidade/região/online, chat (aluno↔profissional do vínculo e todos↔equipe).
- Fase 3: treino por dia da semana e dieta por refeição, registro do que o aluno fez, "Treinos com IA" (Edge Function `routine-ai`).
- Biblioteca de animações próprias (protótipo): remada curvada, agachamento livre, flexão, elevação de quadril — com legendas,
  pausa, fase anterior/próxima e "parar em cada fase". Código: `src/lib/exerciseAnimations.ts` e `src/components/ExerciseAnimationView.tsx`.
- 30 exercícios animados, biblioteca no banco (admin edita, profissional cadastra os seus); nomes parecidos também acham a animação.
- Registro de treino (item 1 do roteiro "Jair/Tiago"): o aluno registra o que fez (exercícios, séries, carga, esforço 1–10,
  dor, recado) até 7 dias atrás, ou "Concluí todos os exercícios" num toque; o profissional vê "O que seus alunos fizeram". Banco: 18/19.
- Ísis, assistente virtual do profissional (menu "Ísis — assistente"): conversa (texto ou microfone), lê treino atual e registros
  dos alunos, cria/ajusta rascunhos e envia quando o profissional confirma. Edge Function `Isis` (publicada com I maiúsculo); banco 20/21. Nome em
  `ASSISTANT_NAME` (src/lib/supabase/isis.ts) e `NAME` (função).

## Pendências do proprietário
- Supabase: colar 39 (medidas e fotos) e 40 (teste).
- Supabase: 20 aplicado; 21 (teste da Ísis) opcional.
- Supabase: colar 13/14 (Fase 3) se ainda não colou; publicar a função `routine-ai` e o segredo `ANTHROPIC_API_KEY`
  (opcional `ROUTINE_MODEL=claude-haiku-5-5` para custo mínimo).
- Rodar 7 e 8 (encerrar sessões) e conferir a Redirect URL `.../acesso` sem ponto final.
- Auth › Email: OTP 900 s e senha mínima 10.

- Gráficos de evolução (aba "Evolução" do aluno; no profissional, em "O que seus alunos fizeram").
- Conteúdos e e-books: parceiro publica em "Meus conteúdos" (aula, vídeo, dica, e-book, estudo, material; grátis ou pago;
  todos da 369 com aprovação do admin, meus alunos, ou alunos/grupos escolhidos; libera acesso dos pagos manualmente);
  aluno vê em "Conteúdos e e-books", na home e abaixo do treino; admin aprova em "Conteúdos". Arquivos no bucket privado
  `conteudos` (até 25 MB).

- Treino guiado ("Começar treino guiado"): um exercício por vez, séries marcadas uma a uma, cronômetro de descanso com
  bipe/vibração, tela acesa, sugestão de carga (sobrecarga progressiva, regras em `src/lib/evolution.ts`) e registro no final.
- Desafios e água: aluno em "Desafios e água" (aceitar, marcar dia; treino e água contam sozinhos; copos de água,
  meta, gráfico de 7 dias e lembretes com o app aberto); parceiro em "Desafios" (cria para os alunos, vê participantes);
  admin em "Desafios" (para todos). Home do aluno: água de hoje e desafio em andamento.
- Avaliações: aluno avalia o profissional e vice-versa (depois de vínculo aceito; uma a cada 30 dias). Média = 100 últimas
  sem as 3 piores (com 3 ou menos, todas). Estrelas na busca e na vitrine, comentários na vitrine, nota do aluno para os
  profissionais em "Meus alunos"; admin modera em "Avaliações".
- Admin › Usuários: busca por nome/e-mail; aprova/recusa pedidos de parceiro; suspende/reativa parceiro; exclui conta
  (motivo + confirmação com e-mail/nome; se houver reservas/carteira/histórico, anonimiza e bloqueia o login); registro de ações.
  Arquivos enviados por um usuário excluído ficam inacessíveis no Storage (limpeza manual, se quiser).
- Meu perfil › Excluir minha conta (aluno e parceiro; admin não): confirma com o e-mail, motivo opcional; apaga ou anonimiza
  como na exclusão pelo admin e encerra a sessão. Fica no registro de ações como autoexclusão.
- Cadastro com escolha "Aluno" ou "Profissional (parceiro)"; profissional cai em "Seja parceiro" logo após entrar (também com
  Google). Link do site: /acesso?perfil=parceiro. Admin › Usuários: "Aprovar" (pedido pendente) e "Tornar parceiro" (sem pedido),
  com área, registro e opção de encerrar vínculo de aluno.
- Registro profissional único: mesmo número no mesmo conselho (CONFEF=CREF, CFP=CRP) não pode estar em duas contas com pedido
  pendente/aprovado; recusado não bloqueia. Admin › Usuários › "Conferir registros profissionais repetidos".
- Verificação em 2 etapas. Etapa 1 = cadastro simples. Etapa 2: CPF em Meu perfil (válido; único → confirmado na hora;
  repetido → aviso e, se a pessoa quiser, análise do admin). Parceiro: CPF + 3 fotos (documento, selfie com documento, selfie
  com carteira do conselho) em Meu cadastro profissional; admin analisa em "Verificações" (fotos apagadas depois). Sem
  verificação o parceiro não aceita novos alunos; selo "Identidade verificada" na busca e na vitrine. Desligar a exigência:
  update wellness_private.app_settings set value='false' where key='exigir_verificacao_parceiro'.
  Futuro (pago): biometria automática com prova de vida (Serpro Datavalid / unico / similares) no lugar da análise manual.
- Fase 4: aluno em "Medidas e fotos" (avaliações com IMC e cintura/quadril, gráficos de peso/gordura/cintura, fotos frente/lado/
  costas privadas com comparar antes/depois e compartilhamento opcional com o profissional); profissional registra e vê em
  Treinos e dietas › "Avaliação física e fotos deste aluno".

## Decisões e próximos passos
- Análise do app do Skip (branch main): trazer na ordem 1) evolução (feito), 2) treino guiado com cronômetro e
  sugestão de carga (feito), 3) Ísis analisando a evolução (feito), 4) desafios e hidratação (feito). Planos/créditos, carteira, ranking e dados
  clínicos só com pagamentos e jurídico (Fase 6).
- Roteiro do comercial (Jair/Tiago): itens 1 (registro), 2 (assistente) e 3 (IA lendo os registros) feitos com a Ísis;
  falta 4) gráfico de evolução para o aluno.
- Imagens/vídeos dos exercícios: plano grátis = animações próprias 369 (ou ExerciseDB, compra única, se preferir);
  plano pago = + vídeo do YouTube por busca automática (profissional pode trocar).
- Próximo: ampliar a biblioteca para os 30 exercícios mais usados (com revisão de um profissional), IA preferindo a biblioteca,
  campo de plano (grátis × pago) por aluno.
- Depois: mais de um profissional por aluno (personal + nutricionista), avaliação física e fotos de evolução (Fase 4),
  desafios/hidratação/e-books (Fase 5), pagamentos (Fase 6).
