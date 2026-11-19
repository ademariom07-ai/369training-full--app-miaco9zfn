# Registro de mudanças aplicadas no Supabase (projeto elahjmtboqhqqxmoaths)

As migrações em `supabase/migrations/` até 20261102131112 foram aplicadas antes da mudança para este repositório.
A partir daqui, cada migração nova é colada no SQL Editor do Supabase pelo proprietário (envolvida em
`begin; ... commit;`) e conferida com o teste correspondente de `supabase/tests/`.
Antes de gerar o arquivo para colar, rodar `scripts/qa/run-sql-tests.sh` (PostgreSQL local descartável).

| Data | Migração | Teste no banco real | Observação |
| --- | --- | --- | --- |
| 15/11/2026 | 20261115120000_quick_signup_contacts.sql | quick_signup_contacts.sql: 18 verificações OK | Cadastro rápido: nome, celular, e-mail e senha. |
| 16/11/2026 | 20261116120000_professional_video_feed.sql | professional_video_feed.sql: 28 verificações (aplicada; teste não confirmado) | Feed de vídeos (YouTube) dos profissionais, com aprovação do admin e ordem por proximidade. |
| 17/11/2026 | 20261117120000_video_feed_flow.sql | video_feed_flow.sql: 9 verificações (aguardando aplicação) | Links do YouTube em mais formatos; admin publica como Equipe 369 WELLNESS; prévia do feed no admin. |
| 18/11/2026 | 20261118120000_onboarding_goal_phone.sql | onboarding_goal_phone.sql: 8 verificações (aguardando aplicação) | Fase 1: objetivo do aluno e celular editável. |
| 19/11/2026 | 20261119120000_showcase_search_chat.sql | showcase_search_chat.sql: 27 verificações OK | Fase 2: vitrine, busca por modalidade/região e chat (vínculo e suporte). |
| 20/11/2026 | 20261120120000_routine_plans.sql | routine_plans.sql: 26 verificações (aguardando aplicação) | Fase 3: treino por dia da semana e dieta por refeição, registro do que o aluno fez, base para IA. |

## Edge Functions

| Data | Função | Segredos | Observação |
| --- | --- | --- | --- |
| 20/11/2026 | routine-ai (supabase/functions/routine-ai/index.ts) | ANTHROPIC_API_KEY (obrigatório), ROUTINE_MODEL e ROUTINE_ALLOWED_ORIGINS (opcionais) | Treino/dieta com IA. Modelo padrão Claude Sonnet 5.5 com esforço baixo (custo menor); Haiku 5.5 opcional. Aguardando publicação no painel. |

## Configurações do painel (Auth)

| Data | Configuração | Valor | Motivo |
| --- | --- | --- | --- |
| 15/11/2026 | Auth → Sign In / Providers → Confirm email | Desligado | Cadastro rápido entra direto; a confirmação de e-mail passa para a etapa "complete seu cadastro", antes do uso real. Conferido em /auth/v1/settings (mailer_autoconfirm=true). |
| 15/11/2026 | Authentication → Emails → SMTP Settings | Brevo (smtp-relay.brevo.com:587) | Envio de e-mails para qualquer endereço; o envio embutido do Supabase só atende a equipe do projeto. |
| 15/11/2026 | Authentication → Emails → Templates → Reset Password | Modelo em português com {{ .Token }} (código de 6 dígitos) | Recuperação por código no site, sem depender do link nem do endereço de retorno. Testado: funcionou. |
| 16/11/2026 | Authentication → URL Configuration | Site URL https://369wellness.ademariom07.workers.dev; Redirect URLs /acesso.html e /acesso | Corrigido (antes: chatgpt.site + localhost, gerava 404). Conferir que a 2ª URL não ficou com ponto final. |
| 16/11/2026 | Authentication → Sign In / Providers → Google | Ligado (Google Cloud: projeto 369 Wellness, cliente Web) | Entrar/cadastrar com Google. Testado: funcionou. Projeto do Google sem faturamento. |
