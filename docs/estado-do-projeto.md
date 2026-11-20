# 369 WELLNESS — estado do projeto (para retomar a conversa)

Atualizado em 20/11/2026. Branch publicado: `prep/supabase-vite` → https://369wellness.ademariom07.workers.dev
Registro das mudanças no banco e no painel: `docs/aplicacoes-banco.md`.

## Pronto e publicado
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
  dor, recado) até 7 dias atrás; o profissional vê "O que seus alunos fizeram" em Treinos e dietas. Banco: 18/19.

## Pendências do proprietário
- Supabase: colar 18 (registro de treino) e depois 19 (teste).
- Supabase: colar 13/14 (Fase 3) se ainda não colou; publicar a função `routine-ai` e o segredo `ANTHROPIC_API_KEY`
  (opcional `ROUTINE_MODEL=claude-haiku-5-5` para custo mínimo).
- Rodar 7 e 8 (encerrar sessões) e conferir a Redirect URL `.../acesso` sem ponto final.
- Auth › Email: OTP 900 s e senha mínima 10.

## Decisões e próximos passos
- Roteiro do comercial (Jair/Tiago): próximos itens são 2) assistente em conversa ("Du, cria o treino da dona Célia…"),
  3) IA lendo o histórico/registros do aluno, 4) evolução e geração para vários alunos.
- Imagens/vídeos dos exercícios: plano grátis = animações próprias 369 (ou ExerciseDB, compra única, se preferir);
  plano pago = + vídeo do YouTube por busca automática (profissional pode trocar).
- Próximo: ampliar a biblioteca para os 30 exercícios mais usados (com revisão de um profissional), IA preferindo a biblioteca,
  campo de plano (grátis × pago) por aluno.
- Depois: mais de um profissional por aluno (personal + nutricionista), avaliação física e fotos de evolução (Fase 4),
  desafios/hidratação/e-books (Fase 5), pagamentos (Fase 6).
