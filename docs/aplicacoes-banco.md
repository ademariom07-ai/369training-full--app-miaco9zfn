# Registro de mudanças aplicadas no Supabase (projeto elahjmtboqhqqxmoaths)

As migrações em `supabase/migrations/` até 20261102131112 foram aplicadas antes da mudança para este repositório.
A partir daqui, cada migração nova é colada no SQL Editor do Supabase pelo proprietário (envolvida em
`begin; ... commit;`) e conferida com o teste correspondente de `supabase/tests/`.
Antes de gerar o arquivo para colar, rodar `scripts/qa/run-sql-tests.sh` (PostgreSQL local descartável).

| Data | Migração | Teste no banco real | Observação |
| --- | --- | --- | --- |
| 15/11/2026 | 20261115120000_quick_signup_contacts.sql | quick_signup_contacts.sql: 18 verificações OK | Cadastro rápido: nome, celular, e-mail e senha. |
| 16/11/2026 | 20261116120000_professional_video_feed.sql | professional_video_feed.sql: 28 verificações (aguardando aplicação) | Feed de vídeos (YouTube) dos profissionais, com aprovação do admin e ordem por proximidade. |

## Configurações do painel (Auth)

| Data | Configuração | Valor | Motivo |
| --- | --- | --- | --- |
| 15/11/2026 | Auth → Sign In / Providers → Confirm email | Desligado | Cadastro rápido entra direto; a confirmação de e-mail passa para a etapa "complete seu cadastro", antes do uso real. Conferido em /auth/v1/settings (mailer_autoconfirm=true). |
