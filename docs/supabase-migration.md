# Preparação Supabase — 369 WELLNESS

## Estado desta entrega

Projeto de destino: `elahjmtboqhqqxmoaths` (`369wellness`). Consulta em 05/10/2026: projeto ativo, sem tabelas public e sem migrações registradas.

Esta branch adiciona o SDK e um cliente opcional para React/Vite. Nenhuma tela, autenticação, operação financeira ou chamada PocketBase foi redirecionada. Não há migração aplicada, importação de dados ou deploy nesta entrega.

## Configuração local

1. Instalar dependências com `pnpm install --frozen-lockfile`.
2. Copiar as variáveis de `.env.supabase.example` para `.env.local` e preencher a chave publicável fornecida pelo projeto.
3. Manter `VITE_POCKETBASE_URL` existente. Não adicionar secret key ou service_role ao frontend.
4. Importar `getSupabaseClient` de `src/lib/supabase/client.ts` somente em fluxos preparados para o novo backend.

O cliente é criado sob demanda: a ausência de configuração não impede as telas atuais. O SDK gerencia persistência e renovação de sessão no navegador. Este projeto não usa Next.js; `next/headers`, middleware SSR e `NEXT_PUBLIC_*` não se aplicam. A sessão PocketBase não autentica o usuário no Supabase.

## Sequência para migração, sujeita a revisão antes de aplicação

| Etapa | Entrega | Critério de aceite |
| --- | --- | --- |
| 1. Inventário | Exportar estrutura real do PocketBase, histórico de migrações e contagens; validar backup/restauração | Fonte e código conciliados; dados de teste identificados |
| 2. Identidade | Supabase Auth, profiles, papéis protegidos e mapa entre IDs PocketBase e UUIDs | Login dos três perfis; papel não editável pelo usuário; estratégia de redefinição de senha aprovada |
| 3. Acesso | Políticas RLS por participante, vínculo e especialidade; separar perfil público de dados sensíveis | Testes entre contas distintas negam acesso indevido; RLS em toda tabela exposta |
| 4. Agenda | Disponibilidade, reservas, pagamento de sinal e cancelamento transacionais | Só uma reserva ativa por horário; confirmação após pagamento; sinal configurável |
| 5. Financeiro | Ledger, reserva de saldo, eventos idempotentes e webhook verificado | Saques não excedem saldo; eventos repetidos não duplicam crédito/débito |
| 6. Ranking | Função central, indicações elegíveis e snapshots mensais | Mesmo resultado por evento, rotina e fechamento; sem limites silenciosos |
| 7. Conteúdo e clínica | Treinos, dietas, protocolos, chat, feed e Storage com políticas | Prontuários, anexos e conversas isolados; relações e arquivos preservados |
| 8. IA e dispositivos | Migrar hooks para backend/Edge Functions e tarefas agendadas | Segredos apenas no servidor; PAR-Q bloqueia quando necessário; webhook assinado |
| 9. Importação | Cópia em ambiente de teste e relatório de reconciliação | Contagens, relações, saldos e arquivos conferidos; nenhuma senha em texto exportada |
| 10. Corte | Trocar serviços/telas após homologação e aprovação | Fluxos completos aprovados; plano de rollback; nenhuma escrita dupla financeira |

## Mapeamento inicial

- `users` → Supabase Auth + profiles + tabelas privadas para dados de saúde e cadastro sensível.
- `weekly_schedules`, `appointments`, `group_sessions`, `group_session_participants` → agenda e reservas com restrições no banco.
- `services`, `service_reviews` → serviços e avaliações com validação de participantes no servidor.
- `wallet_transactions`, `cashback_distributions`, `rank_entries`, `monthly_rank_snapshots`, `referrals`, `platform_config` → módulos financeiros e ranking protegidos.
- `workouts`, `diets`, protocolos, prontuários, progresso marcial, mensagens, conteúdos e desafios → tabelas relacionais com políticas específicas.
- Arquivos do PocketBase → Storage com buckets e políticas separados por sensibilidade.
- Hooks e crons → funções transacionais, Edge Functions e agendamentos; não copiar JavaScript PocketBase como SQL.

Não usar o exemplo `todos`: ele não corresponde ao domínio do produto. Não ativar o Supabase como backend principal enquanto a estrutura estiver vazia.

## Verificações desta preparação

- `pnpm build`: aprovado.
- `pnpm exec tsc -p tsconfig.app.json --noEmit`: aprovado.
- `pnpm exec oxlint src/lib/supabase/client.ts`: aprovado.
- `git diff --check`: aprovado.
- Consulta somente de leitura com o SDK e a chave publicável fornecida: a API respondeu `PGRST205` ao consultar `appointments`, confirmando acesso à API e ausência da tabela no schema exposto. Nenhum registro foi criado. Isso não valida login nem permissões RLS, que dependem das próximas etapas.

## Referência oficial

https://supabase.com/docs/guides/getting-started/tutorials/with-react
