# 369 WELLNESS — banco e pacotes 0–15

Verificado em 05/10/2026. Projeto: `369wellness` / `elahjmtboqhqqxmoaths`.
Branch: `prep/supabase-vite`. Sem merge na main ou publicação do aplicativo.

## Etapa inicial aplicada

Migration `20261005211816_identity_profiles_foundation.sql` aplicada no Supabase, com a mesma versão registrada no histórico remoto. Cria apenas `public.profiles`, referenciando `auth.users`, sem copiar migrations, IDs, contas, senhas ou dados do PocketBase. Nome limitado a 160 caracteres; novos perfis criados pelo cliente recebem papel aluno e approved=false. Papel/aprovação são reservados ao backend confiável; nenhum administrador foi criado e ainda não há fluxo administrativo de promoção.

Cada conta autenticada não anônima pode ler somente o próprio perfil, criar seu próprio registro com id/nome e alterar somente o nome. Sem acesso anônimo, edição de id/papel/aprovação/data de criação, exclusão por cliente ou acesso administrativo global pelo simples valor role. Concessões por coluna são explícitas; INSERT/UPDATE completos não estão autorizados. A migration inicial não cria SECURITY DEFINER ou trigger de cadastro automático. Não há chave secreta no cliente nem decisão de autorização baseada em user_metadata.

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
| 2 | Segurança, vínculo, cashback | Parcial: perfis isolados e protocolo de vínculo no banco; financeiro e telas pendentes |
| 3 | Usuários, ranking, rede, agenda | Parcial: agenda, rede e ranking pendentes |
| 4 | Conclusão de serviços e fechamento | Parcial: transações/idempotência pendentes |
| 5 | Repetição de arquivos anteriores | Parcial: depende dos módulos anteriores |
| 6 | Login e autenticação | Parcial: schema inicial; login Supabase nas telas pendente |
| 7 | Layout e acesso | Parcial: sem troca dos guards ou homologação no navegador |
| 8 | Telas e histórico do aluno | Parcial: persistência Supabase pendente |
| 9 | Telas profissionais | Parcial: vínculo no banco; telas, treino/dieta e avisos Supabase pendentes |
| 10 | Wearable, documentos e usuários | Parcial: documentos/consentimentos/Storage pendentes |
| 11 | Consentimentos e financeiro | Parcial: schemas e validação pendentes |
| 12 | Ranking periódico | Parcial: fórmula e agendamento pendentes |
| 13 | Turmas e resumo financeiro | Parcial: concorrência e pagamentos pendentes |
| 14 | Revisão de migrations | Parcial: tradução/revisão de módulos pendente |
| 15 | Inicialização frontend | Parcial: cliente/tipos preparados; integração das telas pendente |

Totalmente aplicados: **0**. Uma migration concluída não significa um pacote completo.

## Próximas ações

1. Identidade: homologar login/cadastro Supabase e fluxo controlado de solicitação/aprovação profissional; definir mapa de IDs e migração de contas sem importar senhas.
2. Vínculos: integrar o protocolo já aplicado às telas após homologar login; separar catálogo profissional público de dados privados.
3. Treino/dieta/avisos: criação validada no banco, acesso dos participantes, notificação idempotente e leitura por destinatário.
4. Agenda: disponibilidade, capacidade, reservas concorrentes, sinal confirmado pelo gateway, cancelamento.
5. Financeiro/ranking: ledger imutável, webhook assinado, critérios e reconciliação; depois IA, wearable e Storage privado.

Prévia demonstrativa existente: https://wellness-369-demo.ademariom07.chatgpt.site

## Segunda migration — vínculo com aceite

`20261005213915_student_professional_links.sql` aplicada no Supabase real. Tabela student_professional_links com chave primária student_id (um vínculo atual por aluno), FK para perfis, índice professional_id, estados pending/active/revoked, versão positiva e coerência das datas. A tabela contém somente a relação; não amplia leitura de profiles nem libera dados clínicos. Cliente possui somente SELECT com RLS por participante e papel; profissional deve permanecer aprovado. Admin não obtém leitura global pelo simples papel.

RPC request_student_link: aluno autenticado não anônimo solicita um profissional atualmente aprovado. Repetição para o mesmo profissional em pending/active retorna o vínculo atual. Outro profissional exige encerramento anterior. Reabertura após revogação incrementa a versão e limpa o aceite. RPC accept_student_link: somente o profissional escolhido e aprovado aceita a versão exata. RPC revoke_student_link: aluno ou profissional participante encerra pending/active; não aceita versão antiga e não exige que um profissional revogado continue aprovado para encerrar a relação. Operações repetidas de aceite/revogação na mesma versão não duplicam registros.

As três funções públicas são SECURITY INVOKER; os núcleos SECURITY DEFINER ficam em wellness_private, fora do schema público, com search_path vazio, auth.uid/anon checks, papéis consultados do banco e identidade do ator não fornecida pelo cliente. EXECUTE removido de PUBLIC/anon, com grants autenticados explícitos para wrappers e núcleos. O schema privado recebe apenas USAGE para permitir chamadas dos wrappers, sem acesso público anônimo. Perfis são bloqueados em ordem de UUID antes do vínculo, com rechecagem de participante/versão após os locks. Nenhuma nova função privilegiada em public; advisor de segurança não apontou alertas após a migration.

27 verificações SQL executadas previamente no PostgreSQL WASM local e depois no banco real: solicitação/aceite/revogação, idempotência, mudança de versão, profissional sem aprovação, estudante tentando aceitar, outro profissional/estudante, admin sem acesso global, anonimato, INSERT/UPDATE/DELETE diretos negados, troca de vínculo ativo e versões antigas bloqueadas. O teste foi executado com BEGIN/ROLLBACK explícitos e subtransação adicional. A primeira tentativa remota sem a transação externa explícita foi rejeitada pela revisão automática; não foi executada. A execução corrigida passou, com zero usuários, perfis e vínculos persistentes após os testes.

Tipos regenerados do banco real; adaptador links.ts preparado para solicitar, aceitar, encerrar e ler o vínculo próprio ou lista profissional paginada (20 registros). Identidade verificada e respostas de sessão trocada descartadas; payloads não aceitam papel, aprovação, estado ou ator forjado. Oito testes novos com SDK simulado passaram, total de 16 testes locais de perfis/vínculos. TypeScript, build, lint do diretório e diff check aprovados.

Limites: não houve login HTTP, assinatura JWT forjada, eventos de navegador ou teste com sessões concorrentes reais. Locks e PK estão implementados, mas concorrência precisa ser homologada. Não há histórico permanente de versões, trilha de auditoria ou notificação de pedido; a linha atual é reutilizada depois de revogada. Mudança de aprovação bloqueia leitura/aceite do profissional, mas não altera automaticamente o estado do vínculo. Dados clínicos futuros precisarão validar aprovação e vínculo no próprio acesso. Ainda sem catálogo público, importação PocketBase, mudança nas telas ou deploy. Todos os pacotes seguem parciais, zero completos.
