# Preparação Supabase — 369 WELLNESS

## Estado desta entrega

Projeto de destino: `elahjmtboqhqqxmoaths` (`369wellness`). Em 05/10/2026 foram aplicadas `identity_profiles_foundation` (`20261005211816`) e `student_professional_links` (`20261005213915`), criando perfis e vínculo com aceite, com RLS e privilégios explícitos. Em 06/10/2026 UTC, approved_professional_directory (20261006010131) adicionou catálogo mínimo para alunos. Veja `docs/database-status-0-15.md`.

Esta branch contém o SDK, cliente opcional tipado, tipos gerados do banco e funções isoladas para o próprio perfil. As sete migrations estão aplicadas; serviços tipados de perfis e vínculos estão preparados. Nenhuma tela, autenticação existente, operação financeira ou chamada PocketBase foi redirecionada. Não há importação de dados nem deploy.

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

Não usar o exemplo `todos`: ele não corresponde ao domínio do produto. Não ativar o Supabase como backend principal enquanto identidade, vínculos e os módulos usados nas telas não estiverem homologados. A tabela profiles não representa os demais módulos.

## Verificações desta preparação

- `pnpm build`: aprovado.
- `pnpm exec tsc -p tsconfig.app.json --noEmit`: aprovado.
- `pnpm exec oxlint src/lib/supabase/client.ts`: aprovado.
- `git diff --check`: aprovado.
- Consulta somente de leitura com o SDK e a chave publicável fornecida: a API respondeu `PGRST205` ao consultar `appointments`, confirmando acesso à API e ausência da tabela no schema exposto. Nenhum registro foi criado. Isso não valida login nem permissões RLS, que dependem das próximas etapas.

## Referência oficial

https://supabase.com/docs/guides/getting-started/tutorials/with-react

## Validação da primeira migration

14 verificações SQL passaram no Supabase real e previamente em PostgreSQL WASM local (com funções Auth simuladas no teste local). As fixtures foram revertidas, deixando zero usuários e zero perfis persistentes. A API de dados recusou leitura anônima com 42501. Oito testes locais do adaptador passaram; TypeScript, build e lint do diretório Supabase aprovados. Nenhum login real, JWT forjado, fluxo de cadastro, email ou navegador foi testado. A sessão PocketBase continua separada. O advisor de segurança não retornou alertas após revogar EXECUTE de clientes da função de event trigger rls_auto_enable, mantendo o evento ativo. Isso não certifica todo o aplicativo.

## Validação de vínculos

27 verificações SQL de vínculo passaram no banco real, com BEGIN/ROLLBACK explícitos e zero fixtures persistentes. Oito novos testes locais do adaptador passaram (16 de perfis/vínculos no total), TypeScript/build/lint aprovados. Advisor de segurança sem alertas. Nenhuma tela foi redirecionada; main e aplicativo publicado preservados. Veja o status detalhado por pacote e limites em database-status-0-15.md.

## Rota de conta preparada

A branch inclui /conta-supabase fora do contexto PocketBase, com login/restauração, verificação de identidade/perfil, criação e edição do próprio nome, leitura de vínculos e saída local. Nenhum módulo legado foi migrado ou publicado. Onze testes novos locais (27 Supabase no total) passaram; build, TypeScript e lint aprovados. Login real, cadastro Auth, recuperação de senha e navegador ainda pendentes. A prévia demonstrativa não foi atualizada. Consulte database-status-0-15.md para os limites e status por pacote.

## Catálogo e pedido de vínculo

A conta /conta-supabase oferece catálogo paginado mínimo para aluno sem vínculo pendente/ativo, solicitação por profissional escolhido, aceite pelo profissional aprovado e encerramento confirmado pelos participantes. Catálogo e protocolo são funções do banco, sem ampliar RLS de profiles ou acesso clínico. Total atual: 47 testes locais com SDK simulado; 15 novas verificações SQL do catálogo passaram no banco real e local, zero fixtures persistentes e advisor sem alertas. TypeScript/build/lint aprovados. Três migrations aplicadas; interface salva somente na branch. Login/cadastro/recuperação, nomes dos participantes e navegação com contas reais ainda precisam de homologação. A prévia permanece demonstrativa. Nenhum pacote 0–15 está completo.

## Nomes dos participantes

A quarta migration participant_link_summary (20261006012514) acrescenta RPC de vínculos próprios com nome mínimo da contraparte somente em pending/active, condicionado a papel/aprovação atuais. Não amplia acesso direto a profiles; nomes não são devolvidos em revoked. A conta usa essa leitura na lista e confirmação de encerramento. 22 verificações SQL passaram no banco real e local; zero fixtures persistentes e advisor sem alertas. Total atual: 57 testes locais com SDK simulado, TypeScript/build/lint aprovados. Contas reais e navegação ainda não homologadas; nenhuma publicação. Veja database-status-0-15.md.

## Cadastro e recuperação preparados

/conta-supabase inclui cadastro, recuperação por email e nova senha após PASSWORD_RECOVERY da mesma conta. Cadastro não define privilégios; profiles conserva aluno/approved=false. Retorno fixo à origem atual, sem parâmetro de redirecionamento do usuário; exige allowlist /conta-supabase, SMTP e revisão da configuração Auth em ambiente de teste. Não usar a prévia demonstrativa como callback. Nova senha sai da sessão local antes da confirmação, espera local de 60 segundos entre tentativas de email e mensagens genéricas. Senhas não são persistidas pelo aplicativo. Total atual: 70 testes locais com SDK simulado, build/TypeScript/lint aprovados. Nenhum email/conta real, mudança de configuração ou publicação nesta rodada. Homologação de links, sessões concorrentes, termos/consentimento e navegador pendente; recarga do modo de recuperação pode exigir novo link. Veja database-status-0-15.md.

## Solicitação e análise de acesso profissional

Quinta migration professional_applications (20261006122253) aplicada. Solicitação própria não promove papel; administrador autorizado no banco analisa a versão pendente com motivo, registra histórico e promove somente para profissional aprovado. Sem autoaprovação/metadata admin; vínculo ativo/pendente de aluno bloqueia aprovação. Candidaturas/decisões têm RLS por dono/admin e escrita só pelas RPCs. Fila e formulário preparados na conta da branch, sem criar administrador real nem publicar. Trinta verificações SQL passaram local/banco real, zero fixtures; advisor sem alertas. Total atual 82 testes locais SDK simulado, TypeScript/build/lint aprovados. Verificação humana de habilitação, retenção/LGPD, navegador/contas reais e migração geral continuam pendentes. Consulte database-status-0-15.md.

## Treino textual protegido com aviso

Sexta migration protected_training_plans (20261006131737) aplicada. Criação humana de treino requer Educação Física aprovada e versão exata de vínculo ativo; publicação e aviso do aluno são atômicos e idempotentes por chave. RLS nega terceiros/admin, revogação/perda de aprovação e reabertura do vínculo não liberam planos antigos. Aluno marca aviso como lido sem registrar execução. Área isolada /conta-supabase preparada na branch, com paginação e payload/sessão verificados. 31 verificações SQL passaram local/banco real, zero fixtures e advisor sem alertas. Total atual: 94 testes locais com SDK simulado, TypeScript/build/lint aprovados. Sem dieta, exercícios estruturados, revisão, consentimento clínico integrado, navegador/contas reais ou publicação. Veja database-status-0-15.md.

## Conclusão informada pelo aluno

A sétima migration (`20261006133715_training_completion_records.sql`) acrescenta uma conclusão única por treino publicado, independente do aviso lido. O aluno registra por RPC protegida; profissional vinculado lê com as regras atuais do plano. Revogação e nova versão do vínculo impedem leitura de registros antigos. Sem pontos de ranking, sessões repetidas ou prova externa.

Serviços, controlador e confirmação visual preparados em /conta-supabase. 16 verificações SQL reais revertidas, sete suítes SQL locais e 102 testes SDK simulados passaram; TypeScript/lint/build aprovados e advisor sem alertas. Zero usuários reais; Auth/navegador não homologados. Branch somente, prévia demonstrativa inalterada.
