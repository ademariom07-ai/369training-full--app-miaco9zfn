# 369 WELLNESS — banco e pacotes 0–15

Verificado em 05/10/2026. Projeto: `369wellness` / `elahjmtboqhqqxmoaths`.
Branch: `prep/supabase-vite`. Sem merge na main ou publicação do aplicativo.

## Etapa aplicada

Migration `20261005211816_identity_profiles_foundation.sql` aplicada no Supabase, com a mesma versão registrada no histórico remoto. Cria apenas `public.profiles`, referenciando `auth.users`, sem copiar migrations, IDs, contas, senhas ou dados do PocketBase. Nome limitado a 160 caracteres; novos perfis criados pelo cliente recebem papel aluno e approved=false. Papel/aprovação são reservados ao backend confiável; nenhum administrador foi criado e ainda não há fluxo administrativo de promoção.

Cada conta autenticada não anônima pode ler somente o próprio perfil, criar seu próprio registro com id/nome e alterar somente o nome. Sem acesso anônimo, edição de id/papel/aprovação/data de criação, exclusão por cliente ou acesso administrativo global pelo simples valor role. Concessões por coluna são explícitas; INSERT/UPDATE completos não estão autorizados. Sem SECURITY DEFINER novo, trigger de cadastro automático, chave secreta no cliente ou decisão de autorização baseada em user_metadata.

A função existente public.rls_auto_enable teve EXECUTE revogado de PUBLIC/anon/authenticated. A função e o event trigger ensure_rls permaneceram ativos; o advisor passou de dois alertas de execução privilegiada a nenhum alerta.

## Evidência e limites

- 14 verificações SQL no banco real: criação própria/defaults seguros apesar de metadata admin; leitura própria; edição de nome; bloqueio de edição/leitura entre contas; proteção de papel, aprovação e id; criação de perfil de outra conta negada; exclusão negada; isolamento de profissional/admin; bloqueio de Auth anônimo e role anon. Fixtures revertidas por subtransação; zero usuários e perfis persistentes ao final.
- Mesmas 14 verificações executadas antes em PostgreSQL WASM local com auth.uid/auth.jwt simulados. Não representam validação de JWT/GoTrue.
- Uma verificação real da Data API: leitura anônima de profiles negada com 42501, sem linhas retornadas.
- Oito testes locais com SDK simulado das funções readOwnProfile/createOwnProfile/renameOwnProfile: identidade verificada, payload restrito, ID próprio, nome limitado, resposta de outra conta, mudança de token e erro sem confirmação otimista. Sem login HTTP ou navegador.
- Tipos gerados do banco real; cliente tipado; build, TypeScript, lint do diretório Supabase e diff check aprovados. Sem mudança de dependências nesta etapa.

As funções de perfil estão disponíveis na branch, mas ainda não são consumidas pelas telas. Não houve troca de autenticação, migração de dados, importação de arquivos ou execução das migrations PocketBase 0056–0059. A prévia estática continua independente. Não somar estes testes aos 318 testes da reconstrução de outro checkout como se fossem a mesma suíte.

## Status por pacote

| Pacote | Escopo | Situação de banco |
| --- | --- | --- |
| 0 | Base, carteira, chat, administrativo | Parcial: base de identidade criada; demais módulos pendentes |
| 1 | IA e wearable | Parcial: integrações, consentimento e backend pendentes |
| 2 | Segurança, vínculo, cashback | Parcial: perfis isolados; vínculo e financeiro pendentes |
| 3 | Usuários, ranking, rede, agenda | Parcial: agenda, rede e ranking pendentes |
| 4 | Conclusão de serviços e fechamento | Parcial: transações/idempotência pendentes |
| 5 | Repetição de arquivos anteriores | Parcial: depende dos módulos anteriores |
| 6 | Login e autenticação | Parcial: schema inicial; login Supabase nas telas pendente |
| 7 | Layout e acesso | Parcial: sem troca dos guards ou homologação no navegador |
| 8 | Telas e histórico do aluno | Parcial: persistência Supabase pendente |
| 9 | Telas profissionais | Parcial: vínculo, treino/dieta e avisos Supabase pendentes |
| 10 | Wearable, documentos e usuários | Parcial: documentos/consentimentos/Storage pendentes |
| 11 | Consentimentos e financeiro | Parcial: schemas e validação pendentes |
| 12 | Ranking periódico | Parcial: fórmula e agendamento pendentes |
| 13 | Turmas e resumo financeiro | Parcial: concorrência e pagamentos pendentes |
| 14 | Revisão de migrations | Parcial: tradução/revisão de módulos pendente |
| 15 | Inicialização frontend | Parcial: cliente/tipos preparados; integração das telas pendente |

Totalmente aplicados: **0**. Uma migration concluída não significa um pacote completo.

## Próximas ações

1. Identidade: homologar login/cadastro Supabase e fluxo controlado de solicitação/aprovação profissional; definir mapa de IDs e migração de contas sem importar senhas.
2. Vínculos: relação aluno/profissional com regras atômicas; separar catálogo profissional público de dados privados.
3. Treino/dieta/avisos: criação validada no banco, acesso dos participantes, notificação idempotente e leitura por destinatário.
4. Agenda: disponibilidade, capacidade, reservas concorrentes, sinal confirmado pelo gateway, cancelamento.
5. Financeiro/ranking: ledger imutável, webhook assinado, critérios e reconciliação; depois IA, wearable e Storage privado.

Prévia demonstrativa existente: https://wellness-369-demo.ademariom07.chatgpt.site
